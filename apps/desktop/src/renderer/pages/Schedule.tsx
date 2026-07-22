'use client';

import { useState } from 'react';
import { Button } from '@monteai/ui';
import type { ScheduleResponseDto } from '@monteai/types';
import {
  ChevronLeft,
  ChevronRight,
  X,
  MapPin,
  Clock,
  Users,
} from 'lucide-react';

type ViewType = 'day' | 'week' | 'month';

interface DefenseCardProps {
  schedule: ScheduleResponseDto;
  isActive: boolean;
  onClick: () => void;
  columnIndex: number;
}

const DefenseCard = ({ schedule, isActive, onClick, columnIndex }: DefenseCardProps) => {
  const startHour = parseInt(schedule.startTime.split(':')[0]);
  const startMin = parseInt(schedule.startTime.split(':')[1]);
  const topOffset = (startHour - 8) * 60 + startMin;

  const endHour = parseInt(schedule.endingTime.split(':')[0]);
  const endMin = parseInt(schedule.endingTime.split(':')[1]);
  const duration = (endHour - startHour) * 60 + (endMin - startMin);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const randomColors = [
    { bg: 'bg-secondary-fixed', text: 'text-on-secondary' },
    { bg: 'bg-tertiary-fixed', text: 'text-on-tertiary' },
    { bg: 'bg-primary-fixed', text: 'text-on-primary-fixed' },
  ];

  return (
    <div
      className={`absolute w-[19%] rounded-lg p-3 cursor-pointer transition-all shadow-md ${
        isActive
          ? 'bg-status-approved text-white ring-4 ring-primary-container z-20 shadow-xl'
          : 'bg-primary text-white border-l-4 border-secondary-fixed'
      }`}
      style={{
        top: `${topOffset}px`,
        height: `${Math.max(60, duration)}px`,
        left: `${0.5 + columnIndex * 20}%`,
      }}
      onClick={onClick}
    >
      <div className={isActive ? 'flex justify-between items-start mb-1' : 'mb-1'}>
        <span className="text-label-sm font-label-sm opacity-90">
          {schedule.startTime} - {schedule.endingTime}
        </span>
        {isActive && <span className="material-symbols-outlined text-sm">push_pin</span>}
      </div>
      <p className={`font-bold ${isActive ? 'text-md' : 'text-sm'} truncate`}>
        Defense: {schedule.researchGroup?.groupName || 'Untitled'}
      </p>
      <p className={isActive ? 'text-xs mt-1' : 'text-[10px]'}>{schedule.roomVenue}</p>
      {isActive && schedule.panelists.length > 0 && (
        <div className="mt-2 flex -space-x-2">
          {schedule.panelists.slice(0, 3).map((panelist, idx) => {
            const color = randomColors[idx % randomColors.length];
            return (
              <div
                key={panelist.panelistId}
                className={`w-6 h-6 rounded-full border border-white ${color.bg} text-[8px] flex items-center justify-center font-bold ${color.text}`}
              >
                {getInitials(panelist.panelistId)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Mock schedule data for demonstration
const MOCK_SCHEDULES: ScheduleResponseDto[] = [
  {
    scheduleId: '1',
    scheduledBy: 'admin',
    date: '2023-10-09',
    startTime: '09:00',
    endingTime: '10:30',
    roomVenue: 'Room 302',
    researchGroup: {
      id: 'g1',
      groupName: 'Group 302',
      researchTitle: 'Research Project 302',
      adviserId: 'adv1',
      leaderId: 'lead1',
      createdAt: '2023-01-01',
      updatedAt: '2023-01-01',
    },
    panelists: [],
  },
  {
    scheduleId: '2',
    scheduledBy: 'admin',
    date: '2023-10-11',
    startTime: '10:00',
    endingTime: '12:00',
    roomVenue: 'AVR Laboratory',
    researchGroup: {
      id: 'g2',
      groupName: 'Group Balaguer',
      researchTitle: 'ICS BSIT Research',
      adviserId: 'adv2',
      leaderId: 'lead2',
      createdAt: '2023-01-01',
      updatedAt: '2023-01-01',
    },
    panelists: [
      { panelistId: 'Dr. Roland Balmes', panelistType: 'Adviser', scheduleId: '2' },
      { panelistId: 'Ms. Jane Doe', panelistType: 'Panelist', scheduleId: '2' },
      { panelistId: 'Mr. Mark Luna', panelistType: 'Panelist', scheduleId: '2' },
    ],
  },
  {
    scheduleId: '3',
    scheduledBy: 'admin',
    date: '2023-10-10',
    startTime: '11:00',
    endingTime: '11:45',
    roomVenue: 'Conference Room',
    researchGroup: {
      id: 'g3',
      groupName: 'Group 101',
      researchTitle: 'ICS Project 101',
      adviserId: 'adv3',
      leaderId: 'lead3',
      createdAt: '2023-01-01',
      updatedAt: '2023-01-01',
    },
    panelists: [],
  },
  {
    scheduleId: '4',
    scheduledBy: 'admin',
    date: '2023-10-13',
    startTime: '13:00',
    endingTime: '15:00',
    roomVenue: 'AVR Laboratory',
    researchGroup: {
      id: 'g4',
      groupName: 'Group AVR',
      researchTitle: 'AVR Research Initiative',
      adviserId: 'adv4',
      leaderId: 'lead4',
      createdAt: '2023-01-01',
      updatedAt: '2023-01-01',
    },
    panelists: [],
  },
];

export default function Schedule() {
  const [schedules] = useState<ScheduleResponseDto[]>(MOCK_SCHEDULES);
  const [view, setView] = useState<ViewType>('week');
  const [currentDate, setCurrentDate] = useState(new Date(2023, 9, 9)); // Oct 9, 2023
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleResponseDto | null>(null);

  const getWeekDates = (date: Date) => {
    const curr = new Date(date);
    const first = curr.getDate() - curr.getDay();
    const week = [];
    for (let i = 0; i < 5; i++) {
      week.push(new Date(curr.setDate(first + i)));
    }
    return week;
  };

  const weekDates = getWeekDates(new Date(currentDate));
  const dateRange = `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDates[4].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${weekDates[0].getFullYear()}`;

  const schedulesByDay = (dayIndex: number) => {
    const dayDate = weekDates[dayIndex];
    return schedules.filter((s) => {
      const scheduleDate = new Date(s.date);
      return scheduleDate.toDateString() === dayDate.toDateString();
    });
  };

  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const dayLabels = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  const hours = Array.from({ length: 9 }, (_, i) => {
    const hour = 8 + i;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour.toString().padStart(2, '0')}:00 ${ampm}`;
  });

  return (
    <div className="flex h-screen w-full bg-surface-white overflow-hidden">
      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 h-16 border-b border-outline-variant">
          <div className="flex items-center gap-4">
            <h2 className="text-headline-sm font-headline-sm text-on-surface">Defense Schedule</h2>
            <div className="flex border border-outline-variant rounded-lg overflow-hidden">
              <button
                onClick={() => setView('day')}
                className={`px-4 py-1.5 font-label-md text-label-md transition-colors ${
                  view === 'day'
                    ? 'bg-primary text-white'
                    : 'bg-surface-container-high text-on-surface hover:bg-surface-container'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setView('week')}
                className={`px-4 py-1.5 font-label-md text-label-md transition-colors ${
                  view === 'week'
                    ? 'bg-primary text-white'
                    : 'bg-surface-container-high text-on-surface hover:bg-surface-container'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setView('month')}
                className={`px-4 py-1.5 font-label-md text-label-md transition-colors ${
                  view === 'month'
                    ? 'bg-primary text-white'
                    : 'bg-surface-container-high text-on-surface hover:bg-surface-container'
                }`}
              >
                Month
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-body-md font-body-md text-on-surface-variant">{dateRange}</span>
            <div className="flex border border-outline-variant rounded-lg">
              <button
                onClick={handlePrevious}
                className="p-1.5 hover:bg-surface-container transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 border-l border-outline-variant hover:bg-surface-container transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          {/* Day Headers */}
          <div className="schedule-grid border-b border-outline-variant sticky top-0 bg-surface-white z-10 text-center">
            <div className="p-4 border-r border-outline-variant"></div>
            {dayLabels.map((day, idx) => {
              const date = weekDates[idx];
              const isToday = date.toDateString() === new Date().toDateString();
              const isCurrentDay =
                date.toDateString() === weekDates[2].toDateString();
              return (
                <div
                  key={day}
                  className={`p-4 border-r border-outline-variant ${isCurrentDay ? 'bg-surface-container-low' : ''}`}
                >
                  <p className={`text-label-sm font-label-sm ${isToday ? 'text-primary' : 'text-outline'}`}>
                    {day}
                  </p>
                  <p className={`text-headline-sm font-headline-sm ${isToday ? 'text-primary' : ''}`}>
                    {date.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Time Grid */}
          <div className="relative">
            {/* Time Labels and Grid Lines */}
            <div className="schedule-grid">
              <div className="col-span-1 border-r border-outline-variant">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="time-row flex items-center justify-center text-label-sm font-label-sm text-outline"
                  >
                    {hour}
                  </div>
                ))}
              </div>
              <div className="col-span-5 grid grid-cols-5 h-full absolute w-[calc(100%-80px)] left-[80px] top-0 pointer-events-none">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="border-r border-outline-variant h-full"></div>
                ))}
              </div>

              {/* Schedule Blocks */}
              <div className="col-span-5 relative h-[540px]">
                {/* Render schedules for each day */}
                {Array.from({ length: 5 }).map((_, dayIdx) => {
                  const daySchedules = schedulesByDay(dayIdx);

                  return (
                    <div key={dayIdx} className="relative w-full h-full">
                      {daySchedules.map((schedule) => (
                        <DefenseCard
                          key={schedule.scheduleId}
                          schedule={schedule}
                          isActive={selectedSchedule?.scheduleId === schedule.scheduleId}
                          onClick={() => setSelectedSchedule(schedule)}
                          columnIndex={dayIdx}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Detail Panel */}
      <aside
        className={`w-80 bg-surface-white border-l border-outline-variant shadow-lg flex flex-col h-full transform transition-transform duration-300 ${
          selectedSchedule ? 'translate-x-0' : 'translate-x-full'
        } fixed top-0 right-0 z-50 shadow-2xl`}
      >
        {selectedSchedule && (
          <div className="p-6 overflow-y-auto h-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-headline-sm font-headline-sm text-on-surface">Defense Details</h3>
              <button
                onClick={() => setSelectedSchedule(null)}
                className="p-2 hover:bg-surface-container rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Group Info Section */}
            {selectedSchedule.researchGroup && (
              <div className="mb-8 p-4 bg-background-subtle rounded-xl border border-outline-variant">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-white">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-label-sm font-label-sm text-outline uppercase tracking-wider">
                      Group Identity
                    </p>
                    <h4 className="font-bold text-on-surface">
                      {selectedSchedule.researchGroup.groupName}
                    </h4>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-label-sm font-label-sm text-outline">Research Title</p>
                    <p className="text-body-sm font-body-sm font-bold truncate">
                      {selectedSchedule.researchGroup.researchTitle}
                    </p>
                  </div>
                  <div>
                    <p className="text-label-sm font-label-sm text-outline">Group Leader ID</p>
                    <p className="text-body-sm font-body-sm font-bold truncate">
                      {selectedSchedule.researchGroup.leaderId}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Schedule Section */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4">
                <div className="text-primary">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-label-sm font-label-sm text-outline">Defense Date</p>
                  <p className="text-body-md font-body-md font-bold">
                    {new Date(selectedSchedule.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-label-sm font-label-sm text-outline">Time Slot</p>
                  <p className="text-body-md font-body-md font-bold">
                    {selectedSchedule.startTime} - {selectedSchedule.endingTime}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <MapPin className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-label-sm font-label-sm text-outline">Defense Venue</p>
                  <p className="text-body-md font-body-md font-bold">{selectedSchedule.roomVenue}</p>
                </div>
              </div>
            </div>

            {/* Panelists Section */}
            <div className="mb-8">
              <p className="text-label-md font-label-md text-on-surface-variant mb-4 flex items-center justify-between">
                ASSIGNED PANELISTS
                <span className="px-2 py-0.5 bg-primary-fixed text-on-primary-fixed text-[10px] rounded">
                  {selectedSchedule.panelists.length} MEMBERS
                </span>
              </p>
              <div className="space-y-3">
                {selectedSchedule.panelists.length > 0 ? (
                  selectedSchedule.panelists.map((panelist) => (
                    <div
                      key={panelist.panelistId}
                      className="flex items-center justify-between p-2 hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary-fixed text-xs flex items-center justify-center font-bold text-on-secondary">
                          {panelist.panelistId.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-body-sm font-body-sm">{panelist.panelistId}</span>
                      </div>
                      <svg
                        className="w-4 h-4 text-outline"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  ))
                ) : (
                  <p className="text-body-sm text-on-surface-variant">No panelists assigned</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button className="py-2.5 border border-primary text-primary font-bold rounded-lg text-sm hover:bg-surface-container-low transition-colors">
                Reschedule
              </button>
              <Button variant="primary" className="w-full">
                Join Session
              </Button>
            </div>
          </div>
        )}
      </aside>

      {/* Floating Action Button */}
      <button className="fixed bottom-8 right-8 w-14 h-14 bg-status-defense text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-50">
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
