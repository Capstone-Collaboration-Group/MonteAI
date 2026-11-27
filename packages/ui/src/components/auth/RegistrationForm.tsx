import { useState, type ReactNode } from "react";
import { BookUser, Building2, CalendarDays, Eye, EyeOff, GraduationCap, Loader2, Lock, Mail, UserRound } from "lucide-react";
import type { RegistrationRole } from "@monteai/types";
import { FACULTY_EMAIL_DOMAIN } from "@monteai/utils";
import { Button } from "../Button";
import { Input } from "../Input";
import { Select } from "../common/Select";
import { PrivacyNotice } from "./PrivacyNotice";
import { TermsAndConditions } from "./TermsAndConditions";
import { StudentIdVerification } from "./StudentIdVerification";
import { useRegistrationFlow, type RegistrationFormProps, type RegistrationMessage } from "./useRegistrationFlow";
import { INSTITUTE_OPTIONS, SECTION_OPTIONS, YEAR_OPTIONS, programsForInstitute } from "./registrationOptions";

export type { RegistrationFormProps, RegistrationIdVerification } from "./useRegistrationFlow";

function Field({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: ReactNode }) {
  return (
    <label className="min-w-0 space-y-2">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Icon className="h-4 w-4 text-primary" />{label}</span>
      {children}
    </label>
  );
}
function messageBox(message: RegistrationMessage) {
  return message ? <div role={message.type === "error" ? "alert" : "status"}
    className={`rounded-xl border px-4 py-3 text-sm ${message.type === "success"
      ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>{message.text}</div> : null;
}

export function RegistrationForm(props: RegistrationFormProps) {
  const registration = useRegistrationFlow(props);
  const { form, phase, loading, checking, resendIn, message, accountExists, privacyAccepted, termsAccepted,
    active, studentFlow, studentState, signupBusy, ownedAccount, pendingDraft, handleChange, handleRoleChange,
    handleSelectChange,
    handleSubmit, recheckVerification, resendVerification, startOver, editDetails, onRegistered, goToLogin,
    changePrivacy, changeTerms, completeFacultyRegistration, ensureVerifiedAccount } = registration;
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const busy = loading || checking || studentState.busy || signupBusy;

  if (phase === "id") {
    return (
      <div className="flex flex-col gap-4">
        {studentFlow && pendingDraft && props.studentIdVerification ? <StudentIdVerification
          flow={studentFlow} details={pendingDraft} enabled={active && !loading}
          configured={props.studentIdVerification.configured} useMock={props.studentIdVerification.useMock}
          lifetimeSignal={props.lifetimeSignal} ensureVerifiedAccount={ensureVerifiedAccount}
          onRegistered={onRegistered} onEdit={editDetails} /> : <>
          <h2 className="text-2xl font-bold text-slate-900">Verify your student ID</h2>
          <p className="text-sm text-slate-600">Email verified. Student ID capture is not enabled in this application. Finish signup in the web portal or native Android app. There is no file or gallery alternative.</p>
          <Button type="button" variant="secondary" onClick={editDetails}>Edit registration details</Button>
        </>}
        <Button type="button" variant="secondary" disabled={busy || !active} onClick={() => { void startOver(); }}>Cancel sign up</Button>
        <Button type="button" variant="ghost" onClick={() => { void startOver(); }}>Use a different email</Button>
      </div>
    );
  }

  if (phase !== "form") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"><Mail className="h-7 w-7 text-primary" /></div>
          <h2 className="text-2xl font-bold text-slate-900">{phase === "verify" ? "Verify your email" : "Complete faculty registration"}</h2>
          <p className="max-w-md text-sm text-slate-600">
            {phase === "verify" ? <>Open the verification link sent to <span className="font-semibold">{form.email}</span>.
              {form.role === "Student" ? " Once verified, you will confirm your details and explicitly open the ID camera. Email verification alone does not finish signup."
                : " This page continues once your email is verified."}</> : phase === "completing"
              ? "Email verified. Setting up your faculty account…" : "We couldn't finish setting up your faculty account."}
          </p>
        </div>
        {messageBox(message)}
        {phase === "completing" && <>
          <div role="status" className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />Creating your account…
          </div>
          <Button type="button" variant="ghost" onClick={() => { void startOver(); }}>Cancel registration</Button>
          <p className="text-xs text-slate-500">Cancellation does not undo registration already received by the server.</p>
        </>}
        {phase === "verify" && <div className="flex flex-col gap-3">
          <Button type="button" onClick={() => { void recheckVerification(); }} disabled={busy || !active} className="flex w-full justify-center gap-2 py-3">
            {checking && <Loader2 className="h-4 w-4 animate-spin" />}{checking ? "Checking…" : "I've verified my email"}
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="secondary" onClick={() => { void resendVerification(); }} disabled={busy || resendIn > 0 || !active} className="flex-1 justify-center py-3">
              {resendIn > 0 ? `Resend email (${resendIn}s)` : "Resend email"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { void startOver(); }} className="flex-1 justify-center py-3">Use a different email</Button>
          </div>
        </div>}
        {phase === "completeError" && <div className="flex flex-col gap-3">
          <Button type="button" onClick={() => { void completeFacultyRegistration(); }} disabled={busy || !active} className="w-full justify-center py-3">Try again</Button>
          <Button type="button" variant="secondary" onClick={() => { void startOver(); }} className="w-full justify-center py-3">Start over</Button>
          {props.onGoToLogin && <Button type="button" variant="ghost" onClick={goToLogin}>Go to login</Button>}
        </div>}
      </div>
    );
  }

  return (
    <form className="min-w-0" onSubmit={handleSubmit}>
      <fieldset disabled={loading} className="min-w-0 space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {(["Student", "Faculty"] as RegistrationRole[]).map(role => <button key={role} type="button" onClick={() => handleRoleChange(role)}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${form.role === role
              ? "border-primary bg-primary/10 text-primary" : "border-gray-300 bg-white text-slate-600 hover:border-primary/50"}`}>
            {role === "Student" ? <GraduationCap className="h-4 w-4" /> : <BookUser className="h-4 w-4" />}{role}
          </button>)}
        </div>
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <Field label="First / given names" icon={UserRound}><Input className="h-10" name="firstName" value={form.firstName} onChange={handleChange} placeholder="Juan" maxLength={50} required /></Field>
          <Field label="Last name" icon={UserRound}><Input className="h-10" name="lastName" value={form.lastName} onChange={handleChange} placeholder="Dela Cruz" maxLength={50} required /></Field>
        </div>
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <Field label="Middle initial (optional)" icon={UserRound}><Input className="h-10" name="middleInitial" value={form.middleInitial} onChange={handleChange} placeholder="D" maxLength={1} /></Field>
          <Field label="Suffix (optional)" icon={UserRound}><Input className="h-10" name="suffix" value={form.suffix} onChange={handleChange} placeholder="Jr." maxLength={10} /></Field>
        </div>
        <Field label="Email address" icon={Mail}>
          <Input className="h-10" type="email" name="email" value={form.email} onChange={handleChange} placeholder={form.role === "Student" ? "juan@example.com" : "juan@pnm.edu.ph"} maxLength={100} required />
          <span className="block pb-2 text-xs text-slate-500">{form.role === "Student" ? "Personal email addresses are allowed. You must verify this email and your student ID."
            : `Must be a ${FACULTY_EMAIL_DOMAIN} address.`}</span>
        </Field>
        <div className={`grid min-w-0 gap-4 ${form.role === "Student" ? "md:grid-cols-2" : ""}`}>
          {form.role === "Student" && <Field label="Student number" icon={GraduationCap}>
            <Input className="h-10" name="studentNumber" value={form.studentNumber} onChange={handleChange} placeholder="00-00123" maxLength={8} pattern="[0-9]{2}-[0-9]{5}" required />
            <span className="block text-xs text-slate-500">Please follow the format.</span>
          </Field>}
          <Field label="Institute" icon={Building2}>
            <Select
              value={form.institute}
              onChange={(value) => handleSelectChange("institute", value)}
              placeholder="Select your institute"
              options={INSTITUTE_OPTIONS}
              displayValue
              wrapOptions
              className="w-full"
            />
          </Field>
        </div>
        {form.role === "Student" && <>
          <div className="!mt-1">
            <Field label="Program" icon={GraduationCap}>
              <Select
                value={form.program}
                onChange={(value) => handleSelectChange("program", value)}
                placeholder="Select your program"
                options={programsForInstitute(form.institute)}
                displayValue
                wrapOptions
                className="w-full"
              />
            </Field>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Year level" icon={CalendarDays}>
              <Select
                value={form.year}
                onChange={(value) => handleSelectChange("year", value)}
                placeholder="Select year level"
                options={YEAR_OPTIONS}
                className="w-full"
              />
            </Field>
            <Field label="Section" icon={CalendarDays}>
              <Select
                value={form.section}
                onChange={(value) => handleSelectChange("section", value)}
                placeholder="Select your section"
                options={SECTION_OPTIONS}
                className="w-full"
              />
            </Field>
          </div>
        </>}
        {ownedAccount ? <p className="text-sm text-slate-600">Using your pending Firebase account. Editing details discards any earlier ID verification.</p> : <>
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <Field label="Password" icon={Lock}>
              <div className="relative">
                <Input className="h-10" type={showPassword ? "text" : "password"} name="password" value={form.password} onChange={handleChange} placeholder="Create a password" minLength={8} required />
                <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <Field label="Confirm password" icon={Lock}>
              <div className="relative">
                <Input className="h-10" type={showConfirmPassword ? "text" : "password"} name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder="Re-enter password" minLength={8} required />
                <button type="button" aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"} onClick={() => setShowConfirmPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
          </div>
        </>}
        <div className="space-y-0">
          <PrivacyNotice accepted={privacyAccepted} onAcceptedChange={changePrivacy} />
          <TermsAndConditions accepted={termsAccepted} onAcceptedChange={changeTerms} role={form.role} />
        </div>
        {messageBox(message)}
        {accountExists && props.onGoToLogin && <Button type="button" variant="secondary" onClick={goToLogin} className="w-full justify-center py-3">Go to login</Button>}
        {(studentState.busy || signupBusy) && <p role="status" className="text-xs text-slate-500">Earlier camera or signup work is still finishing. New signup work stays blocked until cleanup completes.</p>}
        <Button type="submit" disabled={busy || !active} className="flex w-full justify-center gap-2 py-3">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? "Preparing signup…" : ownedAccount ? "Continue registration" : "Create account"}
        </Button>
      </fieldset>
      {loading && <Button type="button" variant="ghost" onClick={() => { void startOver(); }} className="mt-3 w-full">Cancel account setup</Button>}
    </form>
  );
}
