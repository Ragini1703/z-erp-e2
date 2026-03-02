import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle, XCircle, Clock, TrendingUp, MapPin, Calendar,
  Download, Home, Building2, Laptop, Users, Loader2, AlertCircle, RefreshCw
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  checkIn,
  checkOut,
  startBreak,
  endBreak,
  getTodayAttendance,
  getAttendanceHistory,
  getAttendanceStats,
  type AttendanceRecord,
  type AttendanceStats,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type WorkMode = 'office' | 'remote' | 'hybrid' | 'onsite';

const workModeConfig: Record<WorkMode, {
  label: string;
  icon: React.ElementType;
  color: string;
  location: string;
  badgeColor: string;
}> = {
  office: { label: 'Office', icon: Building2, color: 'bg-blue-500', location: 'Office', badgeColor: 'bg-blue-100 text-blue-700' },
  remote: { label: 'Remote', icon: Home, color: 'bg-green-500', location: 'Work from Home', badgeColor: 'bg-green-100 text-green-700' },
  hybrid: { label: 'Hybrid', icon: Laptop, color: 'bg-purple-500', location: 'Hybrid Mode', badgeColor: 'bg-purple-100 text-purple-700' },
  onsite: { label: 'On-site', icon: Users, color: 'bg-orange-500', location: 'Client Location', badgeColor: 'bg-orange-100 text-orange-700' },
};

/** Format a UTC ISO time-string to HH:MM AM/PM in local timezone */
function formatTime(iso?: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Format minutes → "Xh Ym" */
function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

/** Compute elapsed time from an ISO string until now → "Xh Ym" */
function elapsedSince(isoStart?: string | null): string {
  if (!isoStart) return '0h 0m';
  const diffMs = Date.now() - new Date(isoStart).getTime();
  const mins = Math.floor(diffMs / 60000);
  return formatMinutes(mins);
}

export default function AttendanceDashboard() {
  const { toast } = useToast();

  // ── UI State ────────────────────────────────────────────────
  const [workMode, setWorkMode] = useState<WorkMode>('office');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [historyMonth, setHistoryMonth] = useState('thisMonth');

  // ── Data State ──────────────────────────────────────────────
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);

  // ── Loading / Error ─────────────────────────────────────────
  const [loadingToday, setLoadingToday] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Derived Status ──────────────────────────────────────────
  const isCheckedIn = !!todayRecord?.check_in_time && !todayRecord?.check_out_time;
  const isOnBreak = isCheckedIn && !!todayRecord?.break_start_time && !todayRecord?.break_end_time;
  const isCheckedOut = !!todayRecord?.check_out_time;

  // ── Live Clock ───────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Data Fetching ────────────────────────────────────────────
  const fetchToday = useCallback(async () => {
    setLoadingToday(true);
    const { data, error: err } = await getTodayAttendance();
    setLoadingToday(false);
    if (err) {
      setError(err);
      return;
    }
    setTodayRecord(data || null);
  }, []);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    const { data, error: err } = await getAttendanceStats();
    setLoadingStats(false);
    if (!err && data) setStats(data);
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    let month: string | undefined;
    const now = new Date();
    if (historyMonth === 'thisMonth') {
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    } else if (historyMonth === 'lastMonth') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } else if (historyMonth === 'last3Months') {
      // fetch with higher limit, no month filter
      const { data, error: err } = await getAttendanceHistory({ limit: 90 });
      setLoadingHistory(false);
      if (!err && data) setHistory(data);
      return;
    }
    const { data, error: err } = await getAttendanceHistory({ month });
    setLoadingHistory(false);
    if (!err && data) setHistory(data);
  }, [historyMonth]);

  useEffect(() => { fetchToday(); fetchStats(); }, [fetchToday, fetchStats]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ── Actions ──────────────────────────────────────────────────
  const handleCheckIn = async () => {
    setActionLoading(true);
    const { data, error: err } = await checkIn({ work_mode: workMode, location: workModeConfig[workMode].location });
    setActionLoading(false);
    if (err) {
      toast({ title: 'Check-in Failed', description: err, variant: 'destructive' });
      return;
    }
    setTodayRecord(data!);
    fetchStats();
    toast({ title: '✅ Checked In', description: `Checked in at ${formatTime(data!.check_in_time)}` });
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    const { data, error: err } = await checkOut();
    setActionLoading(false);
    if (err) {
      toast({ title: 'Check-out Failed', description: err, variant: 'destructive' });
      return;
    }
    setTodayRecord(data!);
    fetchHistory();
    fetchStats();
    toast({ title: '👋 Checked Out', description: `Total work: ${data!.work_hours}h` });
  };

  const handleBreakStart = async () => {
    setActionLoading(true);
    const { data, error: err } = await startBreak({ break_type: 'other' });
    setActionLoading(false);
    if (err) {
      toast({ title: 'Break Start Failed', description: err, variant: 'destructive' });
      return;
    }
    setTodayRecord(data!);
    toast({ title: '☕ Break Started', description: `Break started at ${formatTime(data!.break_start_time)}` });
  };

  const handleBreakEnd = async () => {
    setActionLoading(true);
    const { data, error: err } = await endBreak();
    setActionLoading(false);
    if (err) {
      toast({ title: 'Break End Failed', description: err, variant: 'destructive' });
      return;
    }
    setTodayRecord(data!.record);
    toast({ title: '✅ Break Ended', description: `Break: ${data!.break_duration_minutes} minutes` });
  };

  // ── Render Helpers ───────────────────────────────────────────
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-500';
      case 'late': return 'bg-amber-500';
      case 'absent': return 'bg-red-500';
      case 'on_leave': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) =>
    status === 'on_leave' ? 'On Leave' : status.charAt(0).toUpperCase() + status.slice(1);

  const statCards = [
    {
      label: 'Present Days',
      value: loadingStats ? '—' : String(stats?.present_days ?? 0),
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Total Hours',
      value: loadingStats ? '—' : `${stats?.total_hours ?? 0}h`,
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Avg Hours/Day',
      value: loadingStats ? '—' : `${stats?.avg_hours_per_day ?? 0}h`,
      icon: TrendingUp,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      label: 'Absent Days',
      value: loadingStats ? '—' : String(stats?.absent_days ?? 0),
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Attendance & Check-In</h1>
          <p className="text-sm text-gray-500 mt-1">Track your attendance and manage check-in/out</p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
            <AlertCircle size={18} />
            <span className="text-sm">{error}</span>
            <button onClick={() => { setError(null); fetchToday(); }} className="ml-auto">
              <RefreshCw size={16} />
            </button>
          </div>
        )}

        {/* Check-In Card */}
        <Card className={`relative overflow-hidden border-0 shadow-xl ${isCheckedIn
            ? 'bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600'
            : isCheckedOut
              ? 'bg-gradient-to-br from-gray-500 via-slate-500 to-gray-600'
              : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600'
          }`}>
          {isCheckedIn && (
            <div className="absolute inset-0 bg-white/10 animate-pulse pointer-events-none" />
          )}

          <CardContent className="p-8 relative z-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left text-white flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-3 h-3 rounded-full ${isCheckedIn ? 'bg-white animate-pulse' : isCheckedOut ? 'bg-white/30' : 'bg-white/50'}`} />
                  <p className="text-white/90 font-medium">
                    {isCheckedOut ? 'You have checked out' : isCheckedIn ? 'You are checked in' : 'Ready to check in'}
                  </p>
                </div>

                <div className="text-6xl font-bold mb-2">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>

                <p className="text-lg text-white/90 mb-4">
                  {currentTime.toLocaleDateString('en-US', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                  })}
                </p>

                <div className="flex flex-wrap gap-3 items-center justify-center md:justify-start">
                  {todayRecord?.work_mode && (
                    <Badge className={`${workModeConfig[todayRecord.work_mode as WorkMode]?.color} text-white border-white/30 text-sm px-3 py-1`}>
                      {workModeConfig[todayRecord.work_mode as WorkMode]?.location}
                    </Badge>
                  )}
                  {isCheckedIn && todayRecord?.check_in_time && (
                    <Badge className="bg-white/20 text-white border-white/30 text-sm px-3 py-1">
                      <CheckCircle size={14} className="mr-2" />
                      In: {formatTime(todayRecord.check_in_time)}
                    </Badge>
                  )}
                  {isCheckedIn && (
                    <Badge className="bg-white/20 text-white border-white/30 text-sm px-3 py-1">
                      <Clock size={14} className="mr-2" />
                      Work: {elapsedSince(todayRecord?.check_in_time)}
                    </Badge>
                  )}
                  {(isCheckedIn || isCheckedOut) && (todayRecord?.total_break_minutes ?? 0) > 0 && (
                    <Badge className="bg-amber-500/30 text-white border-amber-400/50 text-sm px-3 py-1">
                      <Clock size={14} className="mr-2" />
                      Break: {formatMinutes(todayRecord!.total_break_minutes!)}
                    </Badge>
                  )}
                  {isOnBreak && (
                    <Badge className="bg-red-500/30 text-white border-red-400/50 text-sm px-3 py-1 animate-pulse">
                      On Break
                    </Badge>
                  )}
                  {isCheckedOut && todayRecord?.check_out_time && (
                    <Badge className="bg-white/20 text-white border-white/30 text-sm px-3 py-1">
                      <XCircle size={14} className="mr-2" />
                      Out: {formatTime(todayRecord.check_out_time)}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 min-w-[200px]">
                {loadingToday ? (
                  <div className="flex items-center justify-center p-6">
                    <Loader2 className="animate-spin text-white" size={24} />
                  </div>
                ) : !isCheckedIn && !isCheckedOut ? (
                  <>
                    {/* Work Mode Selector */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
                      <p className="text-white/80 text-xs mb-2 text-center font-medium">Select Work Mode</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(workModeConfig) as WorkMode[]).map((mode) => {
                          const config = workModeConfig[mode];
                          const Icon = config.icon;
                          return (
                            <button
                              key={mode}
                              onClick={() => setWorkMode(mode)}
                              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${workMode === mode
                                  ? 'bg-white text-gray-800 shadow-lg scale-105'
                                  : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                            >
                              <Icon size={14} />
                              {config.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <Button
                      size="lg"
                      onClick={handleCheckIn}
                      disabled={actionLoading}
                      className="bg-white/95 hover:bg-white text-indigo-600 shadow-2xl border-2 border-white/50 h-14 px-8 text-lg font-semibold"
                    >
                      {actionLoading ? <Loader2 size={20} className="mr-2 animate-spin" /> : <CheckCircle size={20} className="mr-2" />}
                      Check In
                    </Button>
                  </>
                ) : isCheckedIn ? (
                  <>
                    {!isOnBreak ? (
                      <Button
                        size="lg"
                        onClick={handleBreakStart}
                        disabled={actionLoading}
                        className="bg-amber-500/90 hover:bg-amber-500 text-white shadow-xl border-2 border-amber-400/50 h-12 px-6 font-semibold"
                      >
                        {actionLoading ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Clock size={18} className="mr-2" />}
                        Start Break
                      </Button>
                    ) : (
                      <Button
                        size="lg"
                        onClick={handleBreakEnd}
                        disabled={actionLoading}
                        className="bg-orange-500/90 hover:bg-orange-500 text-white shadow-xl border-2 border-orange-400/50 h-12 px-6 font-semibold animate-pulse"
                      >
                        {actionLoading ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Clock size={18} className="mr-2" />}
                        End Break
                      </Button>
                    )}
                    <Button
                      size="lg"
                      onClick={handleCheckOut}
                      disabled={actionLoading}
                      className="bg-white/95 hover:bg-white text-green-600 shadow-2xl border-2 border-white/50 h-14 px-8 text-lg font-semibold"
                    >
                      {actionLoading ? <Loader2 size={20} className="mr-2 animate-spin" /> : <XCircle size={20} className="mr-2" />}
                      Check Out
                    </Button>
                  </>
                ) : (
                  <div className="text-center text-white/80 py-4">
                    <CheckCircle size={32} className="mx-auto mb-2 text-white" />
                    <p className="font-semibold">Day Complete!</p>
                    <p className="text-sm mt-1">Work: {todayRecord?.work_hours ?? 0}h</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.label} className="bg-white/70 backdrop-blur-sm border-gray-200 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                  </div>
                  <div className={`${stat.bgColor} p-3 rounded-xl`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Attendance History */}
        <Card className="bg-white/70 backdrop-blur-sm border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Attendance History</CardTitle>
              <div className="flex gap-2">
                <Select value={historyMonth} onValueChange={setHistoryMonth}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thisMonth">This Month</SelectItem>
                    <SelectItem value="lastMonth">Last Month</SelectItem>
                    <SelectItem value="last3Months">Last 3 Months</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" className="gap-2">
                  <Download size={16} />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-gray-400" size={28} />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Calendar size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No attendance records found</p>
                <p className="text-sm mt-1">Check in to start tracking your attendance.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="border-b">
                      {['Date', 'Check In', 'Check Out', 'Break Start', 'Break End', 'Break Dur.', 'Work Mode', 'Location', 'Work Hrs', 'Status'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((record, idx) => {
                      const mode = record.work_mode as WorkMode | undefined;
                      return (
                        <tr
                          key={record.id}
                          className={`border-b hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                        >
                          <td className="px-4 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                            {new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600">{formatTime(record.check_in_time)}</td>
                          <td className="px-4 py-4 text-sm text-gray-600">
                            {record.check_out_time ? formatTime(record.check_out_time) : (
                              <Badge className="bg-blue-100 text-blue-700 animate-pulse">Active</Badge>
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600">{formatTime(record.break_start_time)}</td>
                          <td className="px-4 py-4 text-sm text-gray-600">
                            {record.break_end_time ? formatTime(record.break_end_time) : (record.break_start_time ? (
                              <Badge className="bg-amber-100 text-amber-700 animate-pulse">On Break</Badge>
                            ) : '-')}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600">
                            {(record.total_break_minutes ?? 0) > 0 ? (
                              <Badge className="bg-amber-50 text-amber-700 border border-amber-200">
                                {formatMinutes(record.total_break_minutes!)}
                              </Badge>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-4 text-sm">
                            {mode ? (
                              <Badge className={workModeConfig[mode]?.badgeColor || 'bg-gray-100 text-gray-700'}>
                                {workModeConfig[mode]?.label}
                              </Badge>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <MapPin size={13} className="text-gray-400 shrink-0" />
                              {record.location || '-'}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm font-medium text-gray-900">
                            {record.work_hours ? `${record.work_hours}h` : '-'}
                          </td>
                          <td className="px-4 py-4">
                            <Badge className={`${getStatusColor(record.status)} text-white`}>
                              {getStatusLabel(record.status)}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
