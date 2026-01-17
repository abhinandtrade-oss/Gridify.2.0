# Payroll System Architecture & Payslip Specification

## 1. Overview
This document defines the technical and design specifications for the HR Solutions Payroll System, specifically tailored for Indian payroll compliance. The system ensures data immutability, role-based access control, and comprehensive auditability.

## 2. Firestore Document Schema (`payslips` collection)
Path: `/organizations/{orgId}/payroll/{documentId}`

```json
{
  "meta": {
    "orgId": "string",
    "employeeId": "string",
    "employeeUid": "string", // Email or Auth UID
    "month": "YYYY-MM", // Payroll period
    "payslipNo": "string", // Unique: ORG-YYYYMM-EMP001
    "generatedAt": "timestamp",
    "releasedAt": "timestamp",
    "status": "RELEASED", // DRAFT, RELEASED, VOID
    "hash": "string" // SHA-256 checksum of critical values
  },
  "organization": {
    "name": "string",
    "address": "string",
    "logoUrl": "string",
    "taxIds": {
      "tan": "string",
      "pf": "string",
      "esi": "string"
    }
  },
  "employee": {
    "name": "string",
    "designation": "string",
    "department": "string",
    "dateOfJoining": "string", // ISO Date
    "bankDetails": {
      "bankName": "string",
      "accountNumber": "string", // Masked: ************1234
      "ifsc": "string",
      "paymentMode": "Bank Transfer"
    },
    "taxIds": {
      "pan": "string", // Masked
      "uan": "string",
      "esi": "string"
    }
  },
  "attendanceSummary": {
    "totalDays": 30, // Calendar days in month
    "workedDays": 22,
    "paidDays": 28, // Worked + Approved Leaves + Weekoffs
    "unpaidDays": 2, // LOP
    "leaveEncashmentDays": 0,
    "overtimeHours": 0
  },
  "earnings": {
    "fixed": [
      { "name": "Basic Salary", "amount": 50000, "isTaxable": true },
      { "name": "HRA", "amount": 20000, "isTaxable": true },
      { "name": "Special Allowance", "amount": 15000, "isTaxable": true }
    ],
    "variable": [
      { "name": "Performance Bonus", "amount": 5000, "isTaxable": true },
      { "name": "Overtime", "amount": 1200, "isTaxable": true }
    ],
    "grossEarnings": 91200
  },
  "deductions": {
    "statutory": [
      { "name": "Provident Fund (Employee)", "amount": 1800 },
      { "name": "Professional Tax", "amount": 200 },
      { "name": "Income Tax (TDS)", "amount": 2500 },
      { "name": "ESI", "amount": 0 }
    ],
    "other": [
      { "name": "Loan Recovery", "amount": 0 }
    ],
    "totalDeductions": 4500
  },
  "employerContributions": {
    "pf": 1800, // Matching contribution
    "esi": 0
  },
  "netPay": {
    "amount": 86700,
    "words": "Eighty-Six Thousand Seven Hundred Only",
    "currency": "INR"
  },
  "compliance": {
    "disclaimer": "This is a computer-generated document.",
    "digitalSignature": "string" // Optional URL or Hash
  }
}
```

## 3. Payslip Layout Structure (UI Design)

The UI is designed as a digital A4 document, centered on the screen, using a "Paper" aesthetic within the glassmorphism app.

### Sections
1.  **Header Strip**: Org Logo (Left), Org Address & Tax IDs (Right).
2.  **Title Bar**: "PAYSLIP FOR [MONTH YEAR]" | Status Badge (Paid/Released).
3.  **Employee Summary Grid (2x4)**:
    *   Name, Employee ID, Designation, Department.
    *   Bank A/c, PAN, UAN, Days Payable.
4.  **Financial Table (2 Columns)**:
    *   **Left Column (Earnings)**: List of all earning components + Gross Total.
    *   **Right Column (Deductions)**: List of all deduction components + Total Deductions.
5.  **Net Pay Highlight**: A prominent band showing Net Pay (Numeric) and Amount in Words.
6.  **Footer**: Disclaimer, Generated Date, "Authorized Signatory" placeholder.

## 4. Calculation Logic (High-Level)

1.  **Attendance Factor**: `Paid_Days / Calendar_Days_In_Month`
    *   `Paid_Days` = `Calendar_Days` - `LOP_Days`
2.  **Proration**:
    *   For Fixed Components (Basic, HRA, etc.): `Actual = Defined_Amount * Attendance_Factor`
3.  **Statutory Deductions (India)**:
    *   **PF (Provident Fund)**: 12% of (Basic + DA), capped at ₹1,800 if Basic > 15k (configurable).
    *   **ESI**: 0.75% of Gross if Gross < 21,000.
    *   **Professional Tax**: State-dependent slabs (approx ₹200/month).
    *   **TDS**: 1/12th of estimated annual tax liability (input by admin).
4.  **Net Pay**: `(Gross Earnings) - (Total Deductions)`.

## 5. Edge Cases
*   **Zero Attendance**: Payslip generated with 0 values but compliant record exists.
*   **Mid-Month Join**: Proration logic uses `Effective_Days / Calendar_Days`.
*   **Bonus Month**: Variable earnings section expands dynamically.
*   **Negative Salary**: Hard validation error; Net Pay cannot be negative (carry forward as arrears).

## 6. Access Control & Security
*   **RLS (Row Level Security)**:
    *   `employees` can `read` ONLY if `resource.data.employeeUid == request.auth.uid`.
    *   `org_admins` can `read/write` all docs in their `custom_org_id`.
*   **Immutability**: Once `status` is 'RELEASED', Cloud Functions/Rules prevent updates.
