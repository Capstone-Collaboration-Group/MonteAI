using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using server.Data;
using server.Models.DTOs.Notification;
using server.Models.Entities;
using server.Services.Interfaces;
using Xunit;

namespace server.Tests;

// Exercises the polling surface end to end through the real pipeline
// (auth middleware, role middleware, NotificationController) on SQLite:
// list/unread-count, per-user read isolation, and the announcement fan-out
// scoping rules (Admin => all active users, ProgramHead => own institute).
[Collection(WebFactoryCollection.Name)]
public class NotificationIntegrationTests
{
    private const string StudentUid = "notif-student-1";
    private const string StudentEmail = "notif.student@student.pnm.edu.ph";
    private const string StudentToken = "fake-firebase-token-notif-1";

    private sealed record UnreadCountResponse(int UnreadCount);

    private static HttpClient CreateAuthedClient(MfaWebFactory factory, string token)
    {
        var client = factory.CreateJsonClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    // Inserts notification rows straight through the DbContext so tests don't
    // need a full group/schedule setup just to have rows to page.
    private static async Task SeedNotifications(MfaWebFactory factory, string uid, int count, bool read = false)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        for (var i = 0; i < count; i++)
        {
            db.Notifications.Add(new Notification
            {
                UserId = uid,
                Type = NotificationKinds.Announcement,
                Title = $"Title {i}",
                Body = $"Body {i}",
                TargetType = NotificationKinds.TargetAnnouncement,
                TargetId = Guid.NewGuid().ToString(),
                IsRead = read,
                CreatedAt = DateTime.UtcNow.AddSeconds(-i),
            });
        }
        await db.SaveChangesAsync();
    }

    private static async Task<int> GetUnreadCountAsync(HttpClient client)
    {
        var res = await client.GetAsync("/api/v1/notification/unread-count");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<UnreadCountResponse>();
        return body!.UnreadCount;
    }

    [Fact]
    public async Task GetNotifications_ReturnsPagedList()
    {
        using var factory = new MfaWebFactory();
        factory.EnsureSchema();
        factory.SeedStudent(StudentUid, StudentEmail);
        factory.Firebase.Register(StudentToken, new FakeFirebaseUser(StudentUid, StudentEmail));
        await SeedNotifications(factory, StudentUid, 3);

        var client = CreateAuthedClient(factory, StudentToken);
        var res = await client.GetAsync("/api/v1/notification?page=1&pageSize=2");

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<NotificationPageResponseDto>();
        Assert.NotNull(body);
        Assert.Equal(2, body!.Items.Count);
        Assert.Equal(3, body.TotalCount);
        Assert.Equal(3, body.UnreadCount);
        Assert.All(body.Items, n => Assert.Equal(NotificationKinds.TargetAnnouncement, n.TargetType));
        Assert.All(body.Items, n => Assert.False(n.IsRead));
    }

    [Fact]
    public async Task GetUnreadCount_ReflectsReadState()
    {
        using var factory = new MfaWebFactory();
        factory.EnsureSchema();
        factory.SeedStudent(StudentUid, StudentEmail);
        factory.Firebase.Register(StudentToken, new FakeFirebaseUser(StudentUid, StudentEmail));
        await SeedNotifications(factory, StudentUid, 2);
        await SeedNotifications(factory, StudentUid, 1, read: true);

        var client = CreateAuthedClient(factory, StudentToken);
        Assert.Equal(2, await GetUnreadCountAsync(client));
    }

    [Fact]
    public async Task MarkRead_IsScopedToCaller_OtherUsersUnaffected()
    {
        using var factory = new MfaWebFactory();
        factory.EnsureSchema();
        const string otherUid = "notif-student-2";
        const string otherEmail = "notif2.student@student.pnm.edu.ph";
        const string otherToken = "fake-firebase-token-notif-2";
        factory.SeedStudent(StudentUid, StudentEmail, studentNumber: "90000001");
        factory.SeedStudent(otherUid, otherEmail, studentNumber: "90000002");
        factory.Firebase.Register(StudentToken, new FakeFirebaseUser(StudentUid, StudentEmail));
        factory.Firebase.Register(otherToken, new FakeFirebaseUser(otherUid, otherEmail));
        await SeedNotifications(factory, StudentUid, 1);
        await SeedNotifications(factory, otherUid, 1);

        Guid callerId;
        Guid foreignId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            callerId = db.Notifications.First(n => n.UserId == StudentUid).Id;
            foreignId = db.Notifications.First(n => n.UserId == otherUid).Id;
        }

        // Caller marks their own row read...
        var client = CreateAuthedClient(factory, StudentToken);
        var markRes = await client.PatchAsync($"/api/v1/notification/{callerId}/read", null);
        Assert.Equal(HttpStatusCode.OK, markRes.StatusCode);
        Assert.Equal(0, await GetUnreadCountAsync(client));

        // ...and the other user's unread row is untouched.
        var otherClient = CreateAuthedClient(factory, otherToken);
        Assert.Equal(1, await GetUnreadCountAsync(otherClient));

        // Marking a foreign id returns 404 (ownership scoped).
        var foreignRes = await client.PatchAsync($"/api/v1/notification/{foreignId}/read", null);
        Assert.Equal(HttpStatusCode.NotFound, foreignRes.StatusCode);
    }

    [Fact]
    public async Task MarkAllRead_OnlyAffectsCaller()
    {
        using var factory = new MfaWebFactory();
        factory.EnsureSchema();
        const string otherUid = "notif-student-3";
        const string otherEmail = "notif3.student@student.pnm.edu.ph";
        const string otherToken = "fake-firebase-token-notif-3";
        factory.SeedStudent(StudentUid, StudentEmail, studentNumber: "90000001");
        factory.SeedStudent(otherUid, otherEmail, studentNumber: "90000002");
        factory.Firebase.Register(StudentToken, new FakeFirebaseUser(StudentUid, StudentEmail));
        factory.Firebase.Register(otherToken, new FakeFirebaseUser(otherUid, otherEmail));
        await SeedNotifications(factory, StudentUid, 2);
        await SeedNotifications(factory, otherUid, 2);

        var client = CreateAuthedClient(factory, StudentToken);
        var res = await client.PatchAsync("/api/v1/notification/read-all", null);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(0, await GetUnreadCountAsync(client));

        var otherClient = CreateAuthedClient(factory, otherToken);
        Assert.Equal(2, await GetUnreadCountAsync(otherClient));
    }

    [Fact]
    public async Task Unauthenticated_ReturnsUnauthorized()
    {
        using var factory = new MfaWebFactory();
        factory.EnsureSchema();
        var client = factory.CreateJsonClient();

        var res = await client.GetAsync("/api/v1/notification");

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task AdminAnnouncement_FansOutToAllActiveUsers()
    {
        using var factory = new MfaWebFactory();
        factory.EnsureSchema();
        const string adminUid = "notif-admin-1";
        const string adminEmail = "notif.admin@pnm.edu.ph";
        const string adminToken = "fake-firebase-token-notif-admin";
        const string student2Uid = "notif-student-4";
        const string student2Email = "notif4.student@student.pnm.edu.ph";
        const string student2Token = "fake-firebase-token-notif-4";
        factory.SeedAdmin(adminUid, adminEmail);
        factory.SeedStudent(StudentUid, StudentEmail, studentNumber: "90000001", institute: "CCS");
        factory.SeedStudent(student2Uid, student2Email, studentNumber: "90000002", institute: "CMA");
        factory.Firebase.Register(adminToken, new FakeFirebaseUser(adminUid, adminEmail));
        factory.Firebase.Register(StudentToken, new FakeFirebaseUser(StudentUid, StudentEmail));
        factory.Firebase.Register(student2Token, new FakeFirebaseUser(student2Uid, student2Email));

        var client = CreateAuthedClient(factory, adminToken);
        var res = await client.PostAsJsonAsync("/api/v1/announcement/create", new
        {
            Subject = "Campus-wide announcement",
            Content = "All students must attend the assembly.",
            Category = "Event",
            Priority = "High",
        });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        // Both students (different institutes) receive the college-wide fan-out.
        foreach (var token in new[] { StudentToken, student2Token })
        {
            var studentClient = CreateAuthedClient(factory, token);
            var pageRes = await studentClient.GetAsync("/api/v1/notification");
            var page = await pageRes.Content.ReadFromJsonAsync<NotificationPageResponseDto>();
            Assert.Equal(1, page!.Items.Count);
            Assert.Equal(NotificationKinds.Announcement, page.Items[0].Type);
            Assert.Equal(NotificationKinds.TargetAnnouncement, page.Items[0].TargetType);
        }
    }

    [Fact]
    public async Task ProgramHeadAnnouncement_FansOutToOwnInstituteOnly()
    {
        using var factory = new MfaWebFactory();
        factory.EnsureSchema();
        const string headUid = "notif-head-1";
        const string headEmail = "notif.head@pnm.edu.ph";
        const string headToken = "fake-firebase-token-notif-head";
        const string otherInstituteUid = "notif-student-5";
        const string otherInstituteEmail = "notif5.student@student.pnm.edu.ph";
        const string otherInstituteToken = "fake-firebase-token-notif-5";
        factory.SeedProgramHead(headUid, headEmail, institute: "CCS");
        factory.SeedStudent(StudentUid, StudentEmail, studentNumber: "90000001", institute: "CCS");
        factory.SeedStudent(otherInstituteUid, otherInstituteEmail, studentNumber: "90000002", institute: "CMA");
        factory.Firebase.Register(headToken, new FakeFirebaseUser(headUid, headEmail));
        factory.Firebase.Register(StudentToken, new FakeFirebaseUser(StudentUid, StudentEmail));
        factory.Firebase.Register(otherInstituteToken, new FakeFirebaseUser(otherInstituteUid, otherInstituteEmail));

        var client = CreateAuthedClient(factory, headToken);
        var res = await client.PostAsJsonAsync("/api/v1/announcement/create", new
        {
            Subject = "CCS-only announcement",
            Content = "CCS students only.",
            Category = "Update",
            Priority = "Normal",
        });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        // Same-institute student is notified; the other institute is not.
        var ccsClient = CreateAuthedClient(factory, StudentToken);
        Assert.Equal(1, (await (await ccsClient.GetAsync("/api/v1/notification"))
            .Content.ReadFromJsonAsync<NotificationPageResponseDto>())!.Items.Count);

        var otherClient = CreateAuthedClient(factory, otherInstituteToken);
        var otherPage = await (await otherClient.GetAsync("/api/v1/notification"))
            .Content.ReadFromJsonAsync<NotificationPageResponseDto>();
        Assert.Empty(otherPage!.Items);
    }

    // Inserts a group with the given leader directly (Id set explicitly —
    // NEWID() is SQL Server-only and would blow up on SQLite otherwise).
    private static Guid SeedGroup(MfaWebFactory factory, string leaderUid)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var groupId = Guid.NewGuid();
        db.ResearchGroups.Add(new ResearchGroup
        {
            Id = groupId,
            GroupName = "Integration Test Group",
            ResearchTitle = "Testing the notification fan-out",
            LeaderId = leaderUid,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        var leader = db.Students.Find(leaderUid);
        if (leader is not null)
        {
            leader.GroupId = groupId;
            leader.Position = "Leader";
        }
        db.SaveChanges();
        return groupId;
    }

    [Fact]
    public async Task AddMember_CreatesGroupAddedNotificationForStudent()
    {
        using var factory = new MfaWebFactory();
        factory.EnsureSchema();
        const string adminUid = "notif-rg-admin";
        const string adminEmail = "notif.rg.admin@pnm.edu.ph";
        const string adminToken = "fake-firebase-token-notif-rg-admin";
        const string leaderUid = "notif-rg-leader";
        const string leaderEmail = "notif.rg.leader@student.pnm.edu.ph";
        const string memberUid = "notif-rg-member";
        const string memberEmail = "notif.rg.member@student.pnm.edu.ph";
        const string memberToken = "fake-firebase-token-notif-rg-member";
        factory.SeedAdmin(adminUid, adminEmail);
        factory.SeedStudent(leaderUid, leaderEmail, studentNumber: "92000001");
        factory.SeedStudent(memberUid, memberEmail, studentNumber: "92000002");
        factory.Firebase.Register(adminToken, new FakeFirebaseUser(adminUid, adminEmail));
        factory.Firebase.Register(memberToken, new FakeFirebaseUser(memberUid, memberEmail));
        var groupId = SeedGroup(factory, leaderUid);

        var adminClient = CreateAuthedClient(factory, adminToken);
        var res = await adminClient.PostAsJsonAsync(
            $"/api/v1/researchgroup/{groupId}/members", new { studentId = memberUid });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        // The notification lands in the ADDED student's feed, not the admin's.
        var memberClient = CreateAuthedClient(factory, memberToken);
        var page = await (await memberClient.GetAsync("/api/v1/notification"))
            .Content.ReadFromJsonAsync<NotificationPageResponseDto>();
        var item = Assert.Single(page!.Items);
        Assert.Equal(NotificationKinds.GroupAdded, item.Type);
        Assert.Equal(NotificationKinds.TargetResearchGroup, item.TargetType);
        Assert.Equal(groupId.ToString(), item.TargetId);

        var adminPage = await (await adminClient.GetAsync("/api/v1/notification"))
            .Content.ReadFromJsonAsync<NotificationPageResponseDto>();
        Assert.Empty(adminPage!.Items);
    }

    [Fact]
    public async Task RemoveMember_CreatesGroupRemovedNotificationForStudent()
    {
        using var factory = new MfaWebFactory();
        factory.EnsureSchema();
        const string adminUid = "notif-rg-admin2";
        const string adminEmail = "notif.rg.admin2@pnm.edu.ph";
        const string adminToken = "fake-firebase-token-notif-rg-admin2";
        const string leaderUid = "notif-rg-leader2";
        const string leaderEmail = "notif.rg.leader2@student.pnm.edu.ph";
        const string memberUid = "notif-rg-member2";
        const string memberEmail = "notif.rg.member2@student.pnm.edu.ph";
        const string memberToken = "fake-firebase-token-notif-rg-member2";
        factory.SeedAdmin(adminUid, adminEmail);
        factory.SeedStudent(leaderUid, leaderEmail, studentNumber: "92100001");
        factory.SeedStudent(memberUid, memberEmail, studentNumber: "92100002");
        factory.Firebase.Register(adminToken, new FakeFirebaseUser(adminUid, adminEmail));
        factory.Firebase.Register(memberToken, new FakeFirebaseUser(memberUid, memberEmail));
        var groupId = SeedGroup(factory, leaderUid);

        var adminClient = CreateAuthedClient(factory, adminToken);
        var addRes = await adminClient.PostAsJsonAsync(
            $"/api/v1/researchgroup/{groupId}/members", new { studentId = memberUid });
        Assert.Equal(HttpStatusCode.OK, addRes.StatusCode);

        var removeRes = await adminClient.DeleteAsync(
            $"/api/v1/researchgroup/{groupId}/members/{memberUid}");
        Assert.Equal(HttpStatusCode.OK, removeRes.StatusCode);

        var memberClient = CreateAuthedClient(factory, memberToken);
        var page = await (await memberClient.GetAsync("/api/v1/notification"))
            .Content.ReadFromJsonAsync<NotificationPageResponseDto>();
        Assert.Equal(2, page!.Items.Count);
        // Newest first: the removal is on top.
        Assert.Equal(NotificationKinds.GroupRemoved, page.Items[0].Type);
        Assert.Equal(NotificationKinds.GroupAdded, page.Items[1].Type);
    }
}
