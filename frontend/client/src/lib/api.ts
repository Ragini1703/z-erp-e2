/**
 * api.ts
 * Centralised frontend → backend communication layer.
 * All backend calls go through this module. Components never
 * call fetch() directly; they use these typed callbacks instead.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// ─────────────────────────────────────────────────────────────
// Token store
// AuthContext calls setApiToken() after login / logout so that
// every api.ts call automatically carries the right Bearer token.
// ─────────────────────────────────────────────────────────────

let _apiToken: string | null = null;

/**
 * Called by AuthContext immediately after login (set token) and
 * after logout (pass null).  Must be called before any API call.
 */
export function setApiToken(token: string | null): void {
    _apiToken = token;
}

function getAuthHeaders(): Record<string, string> {
    const base: Record<string, string> = { 'Content-Type': 'application/json' };
    if (_apiToken) {
        base['Authorization'] = `Bearer ${_apiToken}`;
    }
    return base;
}

async function apiFetch<T>(
    path: string,
    options: RequestInit = {}
): Promise<{ data?: T; error?: string }> {
    try {
        const res = await fetch(`${BASE_URL}${path}`, {
            ...options,
            headers: {
                ...getAuthHeaders(),
                ...(options.headers as Record<string, string>),
            },
        });

        const json = await res.json();

        if (!res.ok) {
            return { error: json.error || `Request failed with status ${res.status}` };
        }

        return { data: json as T };
    } catch (err) {
        console.error(`API fetch error [${path}]:`, err);
        return { error: 'Network error. Please check your connection.' };
    }
}


// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface Employee {
    id: string;
    user_id: string;
    employee_code?: string;
    full_name: string;
    email: string;
    phone?: string;
    address?: string;
    department?: string;
    position?: string;
    manager?: string;
    join_date?: string;
    status?: string;
    avatar_url?: string;
    emergency_contact_name?: string;
    emergency_contact_relationship?: string;
    emergency_contact_phone?: string;
    bank_name?: string;
    bank_account_number?: string;
    bank_routing_number?: string;
    created_at?: string;
    updated_at?: string;
}

export interface AttendanceRecord {
    id: string;
    user_id: string;
    employee_id?: string;
    date: string;
    status: 'present' | 'absent' | 'late' | 'half_day' | 'on_leave';
    check_in_time?: string;
    check_out_time?: string;
    check_in_note?: string;
    check_out_note?: string;
    break_start_time?: string;
    break_end_time?: string;
    break_type?: string;
    total_break_minutes?: number;
    work_mode?: 'office' | 'remote' | 'hybrid' | 'onsite';
    location?: string;
    work_hours?: number;
    created_at?: string;
    updated_at?: string;
}

export interface AttendanceStats {
    present_days: number;
    absent_days: number;
    total_hours: number;
    avg_hours_per_day: number;
    month: string;
}

// ─────────────────────────────────────────────────────────────
// Employee API
// ─────────────────────────────────────────────────────────────

/** Fetch the current user's employee profile */
export async function getMyEmployee(): Promise<{ data?: Employee; error?: string }> {
    const result = await apiFetch<{ employee: Employee }>('/api/employees/me');
    return result.error ? { error: result.error } : { data: result.data!.employee };
}

/** Update the current user's employee profile */
export async function updateMyEmployee(
    payload: Partial<Employee>
): Promise<{ data?: Employee; error?: string }> {
    const result = await apiFetch<{ employee: Employee }>('/api/employees/me', {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    return result.error ? { error: result.error } : { data: result.data!.employee };
}

/** Fetch all employees (admin) */
export async function getAllEmployees(): Promise<{ data?: Employee[]; error?: string }> {
    const result = await apiFetch<{ employees: Employee[] }>('/api/employees');
    return result.error ? { error: result.error } : { data: result.data!.employees };
}

// ─────────────────────────────────────────────────────────────
// Attendance API
// ─────────────────────────────────────────────────────────────

/** Check in for today */
export async function checkIn(payload: {
    work_mode?: 'office' | 'remote' | 'hybrid' | 'onsite';
    note?: string;
    location?: string;
}): Promise<{ data?: AttendanceRecord; error?: string }> {
    const result = await apiFetch<{ record: AttendanceRecord }>('/api/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return result.error ? { error: result.error } : { data: result.data!.record };
}

/** Check out for today */
export async function checkOut(payload?: {
    note?: string;
}): Promise<{ data?: AttendanceRecord; error?: string }> {
    const result = await apiFetch<{ record: AttendanceRecord }>('/api/attendance/checkout', {
        method: 'POST',
        body: JSON.stringify(payload || {}),
    });
    return result.error ? { error: result.error } : { data: result.data!.record };
}

/** Start a break */
export async function startBreak(payload?: {
    break_type?: 'lunch' | 'tea' | 'short' | 'meeting' | 'other';
}): Promise<{ data?: AttendanceRecord; error?: string }> {
    const result = await apiFetch<{ record: AttendanceRecord }>('/api/attendance/break/start', {
        method: 'POST',
        body: JSON.stringify(payload || {}),
    });
    return result.error ? { error: result.error } : { data: result.data!.record };
}

/** End the current break */
export async function endBreak(): Promise<{
    data?: { record: AttendanceRecord; break_duration_minutes: number };
    error?: string;
}> {
    const result = await apiFetch<{
        record: AttendanceRecord;
        break_duration_minutes: number;
    }>('/api/attendance/break/end', {
        method: 'POST',
    });
    return result.error ? { error: result.error } : { data: result.data };
}

/** Get today's attendance record */
export async function getTodayAttendance(): Promise<{
    data?: AttendanceRecord | null;
    error?: string;
}> {
    const result = await apiFetch<{ record: AttendanceRecord | null }>('/api/attendance/today');
    return result.error ? { error: result.error } : { data: result.data!.record };
}

/** Get attendance history */
export async function getAttendanceHistory(params?: {
    month?: string; // YYYY-MM
    limit?: number;
}): Promise<{ data?: AttendanceRecord[]; error?: string }> {
    const qs = new URLSearchParams();
    if (params?.month) qs.set('month', params.month);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';

    const result = await apiFetch<{ records: AttendanceRecord[] }>(
        `/api/attendance/history${query}`
    );
    return result.error ? { error: result.error } : { data: result.data!.records };
}

/** Get attendance stats for the current month */
export async function getAttendanceStats(): Promise<{
    data?: AttendanceStats;
    error?: string;
}> {
    const result = await apiFetch<{ stats: AttendanceStats }>('/api/attendance/stats');
    return result.error ? { error: result.error } : { data: result.data!.stats };
}
