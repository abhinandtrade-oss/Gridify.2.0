# Working Time & Late Arrival Rule Feature

## Overview
This feature implements a comprehensive late arrival tracking and automatic half-day deduction system for the HR management platform.

## Feature Components

### 1. Organization Settings (Admin Portal)
**Location:** `org/settings.html`

#### Settings UI Fields:
- **Official Work Start Time** - Time input (HH:MM format)
- **Official Work End Time** - Time input (HH:MM format)
- **Grace Period** - Number input (minutes, default: 15)

#### Default Values:
- Work Start Time: 09:00
- Work End Time: 18:00
- Grace Period: 15 minutes

#### Data Storage:
Settings are stored in Firestore under the organization document:
```javascript
{
  workStartTime: "09:00",
  workEndTime: "18:00",
  gracePeriod: 15,
  attendanceRuleEffectiveDate: "2026-01-17" // Auto-set when rules are saved
}
```

### 2. Attendance Evaluation Logic
**Location:** `employee/attendance.html`

#### Punch-In Behavior:
When an employee punches in, the system:

1. **Fetches Organization Settings**
   - Retrieves `workStartTime` and `gracePeriod` from Firestore

2. **Calculates Grace Time**
   ```javascript
   graceTime = workStartTime + gracePeriod
   // Example: 09:00 + 15 min = 09:15
   ```

3. **Evaluates Attendance Status**
   - **On Time (Full Day):** Punch-in ≤ Grace Time
   - **Late (Half Day):** Punch-in > Grace Time

4. **Stores Attendance Record**
   ```javascript
   {
     userId: "employee@example.com",
     date: "2026-01-17",
     checkInTime: serverTimestamp(),
     status: "Running",
     attendanceStatus: "Late" | "Present",
     attendanceType: "Half Day" | "Full Day",
     lateMinutes: 25, // Minutes late beyond grace period
     isLate: true | false
   }
   ```

5. **User Feedback**
   - On Time: "✓ Session initialized. On Time - Full Day."
   - Late: "⚠️ Late arrival detected. 25 minutes late. Marked as Half Day."

### 3. Payroll Impact (Half-Day Deduction)
**Location:** `org/payroll.html`

#### Salary Calculation Logic:

1. **Daily Salary Calculation**
   ```javascript
   dailySalary = monthlySalary / totalWorkingDays
   ```

2. **Attendance Credit System**
   - Full Day Attendance: 1.0 day credit
   - Half Day (Late): 0.5 day credit
   - Absent: 0.0 day credit

3. **Paid Days Calculation**
   ```javascript
   paidDays = fullDays + (halfDays * 0.5) + approvedLeaves + holidays + weeklyOffs
   ```

4. **Salary Deduction**
   - The system automatically applies 50% deduction for half-day attendance
   - Deduction is reflected in the "Paid Days" count
   - Example: 
     - Month: 30 days
     - Full Days: 20
     - Half Days: 5
     - Paid Days: 20 + (5 * 0.5) = 22.5 days

5. **Payroll Display**
   Shows half-day count in the batch processing view:
   ```
   Paid Days: 22.5 / 30
   LOP: 7.5
   Half Days: 5
   ```

### 4. Employee Visibility
**Location:** `employee/dashboard.html`

#### Information Displayed:
- **Work Time Card**
  - Official work hours (e.g., "09:00 to 18:00")
  - Grace period (e.g., "Grace period: 15 minutes")

#### Attendance Status
- Employees can see their attendance status in real-time
- Late arrivals are clearly marked with warning indicators
- Late minutes are displayed for transparency

### 5. Admin Visibility
**Location:** `org/attendance.html`

#### Attendance Log Enhancements:
- **Late Arrival Indicator**
  - Shows "⚠️ Late by X min - Half Day" for late arrivals
  - Shows "✓ On Time - Full Day" for on-time arrivals
  
- **Color Coding**
  - Warning color (yellow/orange) for late arrivals
  - Success color (green) for on-time arrivals

## Data Fields Reference

### Firestore Collections

#### 1. `organizations/{orgId}`
```javascript
{
  workStartTime: "09:00",
  workEndTime: "18:00",
  gracePeriod: 15,
  attendanceRuleEffectiveDate: "2026-01-17"
}
```

#### 2. `organizations/{orgId}/attendance/{docId}`
```javascript
{
  userId: "employee@example.com",
  userName: "John Doe",
  date: "2026-01-17",
  checkInTime: Timestamp,
  checkOutTime: Timestamp,
  status: "Running" | "Completed",
  attendanceStatus: "Late" | "Present",
  attendanceType: "Half Day" | "Full Day",
  lateMinutes: 25,
  isLate: true,
  workingHours: "8.5",
  orgId: "org123"
}
```

#### 3. `organizations/{orgId}/payroll/{docId}`
```javascript
{
  month: "2026-01",
  userId: "employee@example.com",
  userName: "John Doe",
  netSalary: 45000,
  baseSalary: 50000,
  lopDeduction: 5000,
  fullDetails: {
    attendance: {
      daysInMonth: 30,
      paidDays: 22.5,
      lopDays: 7.5,
      halfDays: 5,
      approvedLeaves: 0,
      weeklyOffs: 8
    }
  }
}
```

## Business Rules

### 1. Grace Period Application
- Grace period is added to work start time
- Example: Start time 09:00 + 15 min grace = 09:15
- Punch-in at 09:15 or before = On Time (Full Day)
- Punch-in after 09:15 = Late (Half Day)

### 2. Salary Deduction
- Half-day attendance = 50% of daily salary
- Daily salary = Monthly salary / Total working days in month
- Deduction is automatic during payroll processing

### 3. Policy Effective Date
- Changes apply only from the effective date forward
- Past attendance records are NOT recalculated
- Effective date is automatically set when settings are saved

### 4. Server Timestamp
- All punch-in times use server timestamp
- Prevents time manipulation by employees
- Ensures accurate late arrival detection

### 5. Employee Restrictions
- Employees cannot edit or override the rule
- Employees cannot modify their attendance status
- Only admins can adjust attendance through the admin portal

## Audit & Logging

### Admin Changes
All changes to work time settings are logged with:
- Timestamp of change
- Effective date
- Previous and new values (stored in Firestore history)

### Attendance Records
Each attendance record includes:
- Server timestamp for punch-in/out
- IP address
- GPS location
- Photo verification
- Late arrival status and minutes

## Security Considerations

1. **Server-Side Validation**
   - All timestamps are server-generated
   - Cannot be manipulated by client

2. **Role-Based Access**
   - Only org admins can modify work time settings
   - Employees have read-only access to their own data

3. **Audit Trail**
   - All attendance records are immutable
   - Changes are tracked with timestamps
   - Admin actions are logged

## User Experience

### For Employees:
1. **Clear Visibility**
   - See official work hours on dashboard
   - Know the grace period upfront
   - Receive immediate feedback on punch-in status

2. **Transparency**
   - Late minutes are clearly displayed
   - Attendance type (Full/Half Day) is shown
   - No surprises in payroll

### For Admins:
1. **Easy Configuration**
   - Simple UI for setting work times
   - Clear explanation of rules
   - Warning about effective dates

2. **Comprehensive Reporting**
   - See late arrivals at a glance
   - Track half-day patterns
   - Monitor payroll impact

## Implementation Notes

### Files Modified:
1. `org/settings.html` - Added work time configuration UI
2. `employee/attendance.html` - Added late arrival evaluation logic
3. `employee/dashboard.html` - Added work time display
4. `org/attendance.html` - Added late arrival indicators
5. `org/payroll.html` - Added half-day deduction logic

### Dependencies:
- Firebase Firestore for data storage
- Server timestamp for accurate time tracking
- Existing attendance and payroll systems

### Testing Checklist:
- [ ] Admin can set work times and grace period
- [ ] Settings are saved to Firestore correctly
- [ ] Employee sees work times on dashboard
- [ ] Late punch-in is detected correctly
- [ ] Half-day status is stored in attendance record
- [ ] Payroll calculates half-day deduction correctly
- [ ] Admin sees late arrival indicators
- [ ] Past records are not affected by rule changes

## Future Enhancements

1. **Flexible Rules**
   - Different rules for different departments
   - Different rules for different days of the week
   - Multiple grace periods (e.g., 15 min for first offense, 0 for repeat)

2. **Notifications**
   - Alert employees approaching grace period
   - Notify admins of frequent late arrivals
   - Send reminders about work times

3. **Analytics**
   - Late arrival trends
   - Department-wise analysis
   - Individual employee patterns

4. **Exceptions**
   - Allow admins to override specific instances
   - Support for medical/emergency late arrivals
   - Approval workflow for exceptions
