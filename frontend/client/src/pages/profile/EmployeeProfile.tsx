import { useState, useEffect, useRef, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Download, Edit, Calendar as CalendarIcon, Clock, CheckCircle, XCircle, FileText, Shield, Briefcase, Activity, CheckSquare, Save, Home, Building2, Laptop, Users, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import StatsCard from '@/components/StatsCard';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMyEmployee,
  updateMyEmployee,
  getAttendanceHistory,
  type Employee as EmployeeData,
  type AttendanceRecord as AttRec,
} from '@/lib/api';

interface LeaveRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  status: 'Approved' | 'Pending' | 'Rejected';
  reason?: string;
}



interface PayrollRecord {
  id: string;
  month: string;
  gross: number;
  deductions: number;
  netSalary: number;
  paymentDate: string;
}

export default function EmployeeProfile() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [leaveTypeValue, setLeaveTypeValue] = useState('Annual Leave');
  const [otherLeaveType, setOtherLeaveType] = useState('');
  const [showViewLeaveModal, setShowViewLeaveModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);

  const [leaveFile, setLeaveFile] = useState<File | null>(null);
  const [leavePreviewUrl, setLeavePreviewUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { toast } = useToast();
  const { user } = useAuth();

  // ── Real data from backend ──────────────────────────────
  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttRec[]>([]);
  const [loadingEmployee, setLoadingEmployee] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  // Edit form state (initialised when modal opens)
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editPosition, setEditPosition] = useState('');

  const fetchEmployee = useCallback(async () => {
    setLoadingEmployee(true);
    const { data } = await getMyEmployee();
    if (data) setEmployeeData(data);
    setLoadingEmployee(false);
  }, []);

  const fetchAttendance = useCallback(async () => {
    setLoadingAttendance(true);
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const { data } = await getAttendanceHistory({ month });
    if (data) setAttendanceHistory(data);
    setLoadingAttendance(false);
  }, []);

  useEffect(() => { fetchEmployee(); fetchAttendance(); }, [fetchEmployee, fetchAttendance]);

  // Derive display values: prefer real employee data, fallback to auth metadata
  const authName: string =
    employeeData?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Employee';
  const authEmail: string = employeeData?.email || user?.email || 'employee@company.com';

  // Save profile handler
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    const { data, error } = await updateMyEmployee({
      full_name: editName || undefined,
      phone: editPhone || undefined,
      address: editAddress || undefined,
      department: editDepartment || undefined,
      position: editPosition || undefined,
    });
    setSavingProfile(false);
    if (error) {
      toast({ title: 'Save Failed', description: error, variant: 'destructive' });
      return;
    }
    if (data) setEmployeeData(data);
    setShowEditModal(false);
    toast({ title: 'Profile Updated', description: 'Your profile has been saved.' });
  };

  const handleSubmitLeave = () => {
    setShowLeaveModal(false);
    toast({
      title: "Leave Request Submitted",
      description: "Your leave request has been submitted for approval."
    });
  };

  useEffect(() => {
    return () => {
      if (leavePreviewUrl) {
        URL.revokeObjectURL(leavePreviewUrl);
      }
    };
  }, [leavePreviewUrl]);

  // Employee data — name & email from real backend data; rest fallback to placeholders
  const employee = {
    id: employeeData?.employee_code || 'EMP-001',
    name: authName,
    email: authEmail,
    phone: employeeData?.phone || '+1 555-0100',
    department: employeeData?.department || 'Engineering',
    position: employeeData?.position || 'Employee',
    manager: employeeData?.manager || '—',
    joinDate: employeeData?.join_date || '—',
    status: employeeData?.status === 'active' ? 'Active' : employeeData?.status || 'Active',
    avatar: employeeData?.avatar_url || '',
    address: employeeData?.address || '—',
    emergencyContact: {
      name: employeeData?.emergency_contact_name || '—',
      relationship: employeeData?.emergency_contact_relationship || '—',
      phone: employeeData?.emergency_contact_phone || '—',
    },
    bankDetails: {
      accountNumber: employeeData?.bank_account_number || '****',
      bankName: employeeData?.bank_name || '—',
      routingNumber: employeeData?.bank_routing_number || '****',
    },
  };

  const insurancePolicies = [
    {
      id: '1',
      name: 'Health Insurance Premium',
      coverage: '$500,000',
      premium: '$250/month',
      status: 'Active',
    },
    {
      id: '2',
      name: 'Life Insurance',
      coverage: '$1,000,000',
      premium: '$100/month',
      status: 'Active',
    },
    {
      id: '3',
      name: 'Dental Coverage',
      coverage: '$50,000',
      premium: '$50/month',
      status: 'Active',
    },
  ];

  const leaveRequests: LeaveRequest[] = [
    {
      id: '1',
      type: 'Annual Leave',
      startDate: '2026-02-10',
      endDate: '2026-02-14',
      days: 5,
      status: 'Approved',
    },
    {
      id: '2',
      type: 'Sick Leave',
      startDate: '2026-01-20',
      endDate: '2026-01-21',
      days: 2,
      status: 'Approved',
    },
    {
      id: '3',
      type: 'Personal Leave',
      startDate: '2026-03-05',
      endDate: '2026-03-05',
      days: 1,
      status: 'Pending',
    },
  ];

  const payrollRecords: PayrollRecord[] = [
    {
      id: '1',
      month: 'December 2025',
      gross: 8500,
      deductions: 1200,
      netSalary: 7300,
      paymentDate: '2025-12-31',
    },
    {
      id: '2',
      month: 'November 2025',
      gross: 8500,
      deductions: 1200,
      netSalary: 7300,
      paymentDate: '2025-11-30',
    },
    {
      id: '3',
      month: 'October 2025',
      gross: 8500,
      deductions: 1200,
      netSalary: 7300,
      paymentDate: '2025-10-31',
    },
  ];



  // Helper: format ISO timestamp → HH:MM AM/PM
  const fmtTime = (iso?: string | null) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const fmtMinutes = (m?: number) => {
    if (!m) return '-';
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${h}h ${min}m`;
  };

  // Work mode configuration
  const workModeConfig = {
    office: { label: 'Office', icon: Building2, color: 'bg-blue-100 text-blue-700' },
    remote: { label: 'Remote', icon: Home, color: 'bg-green-100 text-green-700' },
    hybrid: { label: 'Hybrid', icon: Laptop, color: 'bg-purple-100 text-purple-700' },
    onsite: { label: 'On-site', icon: Users, color: 'bg-orange-100 text-orange-700' },
  };

  // Leave balance data
  const leaveBalance = {
    total: 20,
    used: 7,
    pending: 1,
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Success':
      case 'Active':
      case 'Present':
        return 'default';
      case 'Pending':
        return 'outline';
      case 'Rejected':
      case 'Failed':
      case 'Absent':
        return 'destructive';
      case 'Leave':
      case 'Holiday':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const EditProfileModal = () => (
    <Dialog open={showEditModal} onOpenChange={(v) => {
      setShowEditModal(v);
      if (v) {
        // Pre-fill form fields
        setEditName(employee.name);
        setEditPhone(employee.phone);
        setEditAddress(employee.address);
        setEditDepartment(employee.department);
        setEditPosition(employee.position);
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>Update your personal information</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Full Name</Label>
              <Input id="editName" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmail">Email</Label>
              <Input id="editEmail" type="email" defaultValue={employee.email} disabled />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editPhone">Phone</Label>
              <Input id="editPhone" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editAddress">Address</Label>
              <Input id="editAddress" value={editAddress} onChange={e => setEditAddress(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="editDept">Department</Label>
              <Input id="editDept" value={editDepartment} onChange={e => setEditDepartment(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPos">Position</Label>
              <Input id="editPos" value={editPosition} onChange={e => setEditPosition(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={savingProfile}>
            Cancel
          </Button>
          <Button onClick={handleSaveProfile} disabled={savingProfile} className="bg-blue-600 hover:bg-blue-700">
            {savingProfile ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const RequestLeaveModal = () => (
    <Dialog open={showLeaveModal} onOpenChange={setShowLeaveModal}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request Leave</DialogTitle>
          <DialogDescription>Submit a new leave request</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="leaveType">Leave Type</Label>
            <select
              id="leaveType"
              value={leaveTypeValue}
              onChange={(e) => setLeaveTypeValue(e.target.value)}
              className="w-full border rounded-md p-2"
            >
              <option>Annual Leave</option>
              <option>Sick Leave</option>
              <option>Personal Leave</option>
              <option>Emergency Leave</option>
              <option>Other</option>
            </select>
            {leaveTypeValue === 'Other' && (
              <div className="mt-2">
                <Label htmlFor="otherLeaveType">Please specify</Label>
                <Input
                  id="otherLeaveType"
                  value={otherLeaveType}
                  onChange={(e) => setOtherLeaveType(e.target.value)}
                  placeholder="Specify leave type"
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Description</Label>
            <Textarea id="reason" placeholder="Reason for leave" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="leaveAttachment">Attach Document (optional)</Label>

            <input
              id="leaveAttachment"
              ref={inputRef}
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.png"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                if (leavePreviewUrl) {
                  URL.revokeObjectURL(leavePreviewUrl);
                }
                if (file && file.type.startsWith('image/')) {
                  setLeavePreviewUrl(URL.createObjectURL(file));
                } else {
                  setLeavePreviewUrl(null);
                }
                setLeaveFile(file);
              }}
            />

            <div
              ref={containerRef}
              className="w-full border-dashed border-2 border-gray-300 rounded-md p-3 text-center cursor-pointer hover:border-primary transition overflow-hidden"
              onDragOver={(e: any) => { e.preventDefault(); e.stopPropagation(); }}
              onDragEnter={(e: any) => { e.preventDefault(); e.stopPropagation(); }}
              onDragLeave={(e: any) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e: any) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer?.files?.[0] ?? null;
                if (!file) return;
                if (leavePreviewUrl) URL.revokeObjectURL(leavePreviewUrl);
                if (file.type.startsWith('image/')) {
                  setLeavePreviewUrl(URL.createObjectURL(file));
                } else {
                  setLeavePreviewUrl(null);
                }
                setLeaveFile(file);
              }}
              onClick={() => inputRef.current?.click()}
            >
              {!leaveFile ? (
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-gray-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">Drag & drop or click to browse</p>
                  <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, JPG, PNG</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <div className="flex-shrink-0">
                    {leavePreviewUrl ? (
                      <img src={leavePreviewUrl} alt="preview" className="w-12 h-12 object-cover rounded" />
                    ) : (
                      <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-gray-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm truncate font-medium" title={leaveFile.name}>{leaveFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(leaveFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (leavePreviewUrl) URL.revokeObjectURL(leavePreviewUrl);
                      setLeaveFile(null);
                      setLeavePreviewUrl(null);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowLeaveModal(false);
              setLeaveFile(null);
              setLeavePreviewUrl(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              handleSubmitLeave();
              setLeaveFile(null);
              setLeavePreviewUrl(null);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Profile Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={employee.avatar} />
                  <AvatarFallback className="text-2xl">
                    {employee.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold">{employee.name}</h2>
                  <p className="text-muted-foreground">{employee.position}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-4 h-4" />
                      {employee.id}
                    </span>
                    <span>{employee.department}</span>
                    <Badge variant="default">{employee.status}</Badge>
                  </div>
                </div>
              </div>
              <Button onClick={() => setShowEditModal(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="insurance">Insurance</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="leave">Leave</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
          </TabsList>

          {/* TAB 1: PROFILE OVERVIEW */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{employee.email}</p>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{employee.phone}</p>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium">{employee.address}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Employment Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Employment Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Department</p>
                    <p className="font-medium">{employee.department}</p>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Position</p>
                    <p className="font-medium">{employee.position}</p>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Manager</p>
                    <p className="font-medium">{employee.manager}</p>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Join Date</p>
                    <p className="font-medium">{employee.joinDate}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Emergency Contact */}
              <Card>
                <CardHeader>
                  <CardTitle>Emergency Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{employee.emergencyContact.name}</p>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Relationship</p>
                    <p className="font-medium">{employee.emergencyContact.relationship}</p>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{employee.emergencyContact.phone}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Bank Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Bank Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Bank Name</p>
                    <p className="font-medium">{employee.bankDetails.bankName}</p>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Account Number</p>
                    <p className="font-medium">{employee.bankDetails.accountNumber}</p>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Routing Number</p>
                    <p className="font-medium">{employee.bankDetails.routingNumber}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Documents */}
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {['Employment Contract', 'ID Proof', 'Tax Forms', 'Certifications'].map((doc) => (
                    <Button key={doc} variant="outline" className="h-auto py-4 flex flex-col gap-2">
                      <FileText className="w-8 h-8" />
                      <span className="text-sm">{doc}</span>
                      <Download className="w-4 h-4" />
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: INSURANCE */}
          <TabsContent value="insurance" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              {insurancePolicies.map((policy) => (
                <Card key={policy.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <Shield className="w-8 h-8 text-primary" />
                      <Badge variant="default">{policy.status}</Badge>
                    </div>
                    <CardTitle className="text-lg">{policy.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Coverage</p>
                      <p className="text-xl font-bold">{policy.coverage}</p>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground">Premium</p>
                      <p className="text-lg font-semibold">{policy.premium}</p>
                    </div>
                    <Button variant="outline" className="w-full">
                      View Details
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TAB 3: ATTENDANCE */}
          <TabsContent value="attendance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Attendance Records</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Work Mode</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Break Start</TableHead>
                      <TableHead>Break End</TableHead>
                      <TableHead>Break Duration</TableHead>
                      <TableHead>Work Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingAttendance ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-10">
                          <Loader2 className="animate-spin inline-block text-gray-400" size={24} />
                        </TableCell>
                      </TableRow>
                    ) : attendanceHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-10 text-gray-500">
                          No attendance records this month.
                        </TableCell>
                      </TableRow>
                    ) : attendanceHistory.map((record: AttRec) => {
                      const mode = record.work_mode as keyof typeof workModeConfig | undefined;
                      const statusLabel =
                        record.status === 'on_leave' ? 'Leave' :
                          record.status === 'half_day' ? 'Half Day' :
                            record.status.charAt(0).toUpperCase() + record.status.slice(1);
                      const statusVariant = getStatusBadgeVariant(statusLabel);
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{record.date}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant}>{statusLabel}</Badge>
                          </TableCell>
                          <TableCell>
                            {mode ? (() => {
                              const config = workModeConfig[mode];
                              const Icon = config.icon;
                              return (
                                <Badge className={config.color}>
                                  <Icon className="w-3 h-3 mr-1" />
                                  {config.label}
                                </Badge>
                              );
                            })() : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {record.check_in_time && <CheckCircle className="w-4 h-4 text-green-600" />}
                              {fmtTime(record.check_in_time)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {record.check_out_time && <XCircle className="w-4 h-4 text-red-600" />}
                              {fmtTime(record.check_out_time)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {record.break_start_time && <Clock className="w-4 h-4 text-amber-600" />}
                              {fmtTime(record.break_start_time)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {record.break_end_time && <Clock className="w-4 h-4 text-orange-600" />}
                              {fmtTime(record.break_end_time)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {(record.total_break_minutes ?? 0) > 0 ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                {fmtMinutes(record.total_break_minutes)}
                              </Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{record.work_hours ? `${record.work_hours}h` : '-'}</TableCell>
                        </TableRow>
                      );
                    })}

                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>



          {/* TAB 5: LEAVE MANAGEMENT */}
          <TabsContent value="leave" className="space-y-6">
            {/* Leave Summary */}
            <div className="grid gap-4 md:grid-cols-4">
              <StatsCard
                title="Total Leaves"
                value={leaveBalance.total.toString()}
                description="Annual allocation"
                icon={CalendarIcon}
              />
              <StatsCard
                title="Used"
                value={leaveBalance.used.toString()}
                description="Days taken"
                icon={CheckSquare}
              />
              <StatsCard
                title="Balance"
                value={(leaveBalance.total - leaveBalance.used).toString()}
                description="Days remaining"
                icon={Activity}
              />
              <StatsCard
                title="Pending Requests"
                value={leaveBalance.pending.toString()}
                description="Awaiting approval"
                icon={Clock}
              />
            </div>

            {/* Leave Requests */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Leave Requests</CardTitle>
                  <Button onClick={() => setShowLeaveModal(true)}>
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    Request Leave
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveRequests.map((leave) => (
                      <TableRow key={leave.id}>
                        <TableCell className="font-medium">{leave.type}</TableCell>
                        <TableCell>{leave.startDate}</TableCell>
                        <TableCell>{leave.endDate}</TableCell>
                        <TableCell>{leave.days}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(leave.status)}>
                            {leave.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedLeave(leave);
                              setShowViewLeaveModal(true);
                            }}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 6: PAYROLL */}
          <TabsContent value="payroll" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Salary Slips</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Gross Salary</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net Salary</TableHead>
                      <TableHead>Payment Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.month}</TableCell>
                        <TableCell>${record.gross.toLocaleString()}</TableCell>
                        <TableCell className="text-red-600">
                          -${record.deductions.toLocaleString()}
                        </TableCell>
                        <TableCell className="font-semibold text-green-600">
                          ${record.netSalary.toLocaleString()}
                        </TableCell>
                        <TableCell>{record.paymentDate}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modals */}
        <EditProfileModal />
        <RequestLeaveModal />
        {/* View Leave Details Modal */}
        <Dialog open={showViewLeaveModal} onOpenChange={(open) => { if (!open) { setShowViewLeaveModal(false); setSelectedLeave(null); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Leave Details</DialogTitle>
              <DialogDescription>Details for the selected leave request</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {selectedLeave ? (
                <>
                  <div>
                    <Label>Type</Label>
                    <p className="font-medium">{selectedLeave.type}</p>
                  </div>
                  <div>
                    <Label>Start Date</Label>
                    <p className="font-medium">{selectedLeave.startDate}</p>
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <p className="font-medium">{selectedLeave.endDate}</p>
                  </div>
                  <div>
                    <Label>Days</Label>
                    <p className="font-medium">{selectedLeave.days}</p>
                  </div>
                  <div>
                    <Label>Status </Label>
                    <Badge variant={getStatusBadgeVariant(selectedLeave.status)}>{selectedLeave.status}</Badge>
                  </div>
                  {selectedLeave.reason && (
                    <div>
                      <Label>Reason</Label>
                      <p className="whitespace-pre-wrap">{selectedLeave.reason}</p>
                    </div>
                  )}
                </>
              ) : (
                <p>No leave selected.</p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => { setShowViewLeaveModal(false); setSelectedLeave(null); }}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
