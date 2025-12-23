/**
 * Attendance System Business Logic
 */

// Replace with your deployed Google Apps Script URL
const ATTENDANCE_GAS_URL = 'https://script.google.com/macros/s/AKfycbyF_Enx3f0yPb9t-eLRhcJgf0NcK3XRWgNxE2CDPWwcVUPb1BRisa8u2Cqi_6VN4jnKzw/exec';

const AttendanceApp = {
    user: null,
    attendanceData: [],

    async init() {
        console.log("Initializing AttendanceApp...");
        this.showLoading(true);

        // 1. Get User Session (Assuming AdminManager is available from project)
        if (typeof AdminManager !== 'undefined') {
            this.user = AdminManager.getSession();
        }

        if (!this.user) {
            alert("No active session found. Please login.");
            window.location.href = '../../login/';
            return;
        }

        // Update UI based on Role
        document.getElementById('userNameDisplay').innerText = this.user.username;
        document.getElementById('userNameDisplay').classList.remove('d-none');

        if (this.user.role === 'admin') {
            document.getElementById('adminView').classList.remove('d-none');
            document.getElementById('userView').classList.remove('d-none');
            await this.loadAdminDashboard();
            await this.loadUserDashboard();
            await this.initCamera();
        } else {
            document.getElementById('userView').classList.remove('d-none');
            await this.loadUserDashboard();
            await this.initCamera();
        }

        this.bindEvents();
        this.showLoading(false);
    },

    async initCamera() {
        console.log("AttendanceApp.initCamera() called");
        const success = await CameraManager.init('#punchVideo', '#faceCanvas');
        console.log("CameraManager.init result:", success);

        if (!success) {
            document.getElementById('faceStatus').innerHTML = '<span class="badge bg-danger">Camera Access Denied</span>';
            return;
        }

        // Camera is ready, enable buttons immediately
        document.getElementById('faceStatus').innerHTML = '<span class="badge bg-success">Camera Ready</span>';
        this.updatePunchButtons();
    },

    updatePunchButtons() {
        const bIn = document.getElementById('btnPunchIn');
        const bOut = document.getElementById('btnPunchOut');

        const todayRecord = this.getTodayRecord();
        console.log("Determining button state. Today's record:", todayRecord);

        if (!todayRecord) {
            bIn.disabled = false;
            bOut.disabled = true;
        } else if (todayRecord.status === 'Incomplete') {
            bIn.disabled = true;
            bOut.disabled = false;
        } else {
            bIn.disabled = true;
            bOut.disabled = true;
            document.getElementById('punchMessage').innerText = "Shift already completed for today.";
        }
    },

    getTodayRecord() {
        if (!this.attendanceData || this.attendanceData.length === 0) return null;

        // Use local date string YYYY-MM-DD instead of UTC to avoid date mismatch
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        console.log("Searching record for today:", todayStr);

        return this.attendanceData.find(r => {
            // Normalize record date to YYYY-MM-DD
            const rDate = r.date instanceof Date ?
                r.date.toLocaleDateString('sv-SE') :
                new Date(r.date).toLocaleDateString('sv-SE');

            return rDate === todayStr;
        });
    },

    async loadUserDashboard() {
        try {
            const resp = await fetch(ATTENDANCE_GAS_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'fetch_user_attendance',
                    userId: this.user.username
                })
            });
            const result = await resp.json();
            console.log("User Dashboard Data:", result);
            if (result.success) {
                this.attendanceData = result.data;
                this.renderUserTable();
                this.updateTodayStats();
            }
        } catch (e) {
            console.error("Dashboard Load Error:", e);
        }
    },

    renderUserTable() {
        const tbody = document.getElementById('userAttendanceTable');
        tbody.innerHTML = '';

        this.attendanceData.forEach(row => {
            const tr = document.createElement('tr');
            const statusClass = row.status === 'Present' ? 'badge-present' : (row.status === 'Leave' ? 'badge-leave' : 'badge-incomplete');

            // Format date if it's ISO
            const dateObj = new Date(row.date);
            const formattedDate = isNaN(dateObj) ? row.date : dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

            tr.innerHTML = `
                <td>${formattedDate}</td>
                <td>${row.inTime || '--'}</td>
                <td>${row.outTime || '--'}</td>
                <td>${row.duration || '--'}</td>
                <td><span class="badge ${statusClass}">${row.status}</span></td>
            `;
            tbody.appendChild(tr);
        });
    },

    updateTodayStats() {
        const today = this.getTodayRecord();
        if (today) {
            document.getElementById('labelPunchIn').innerText = today.inTime || '--:--';
            document.getElementById('labelPunchOut').innerText = today.outTime || '--:--';
            document.getElementById('labelDuration').innerText = today.duration || '--:--';
        }
    },

    async handlePunch(type) {
        const image = CameraManager.capture();
        if (!image) {
            alert("Unable to capture photo. Please ensure camera is allowed.");
            return;
        }

        this.showLoading(true);

        try {
            const resp = await fetch(ATTENDANCE_GAS_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'punch',
                    userId: this.user.username,
                    userName: this.user.fullName || this.user.username,
                    punchType: type,
                    imageBase64: image
                })
            });
            const result = await resp.json();

            if (result.success) {
                alert(result.message);
                await this.loadUserDashboard();
                this.updatePunchButtons(CameraManager.isFacePresent);
            } else {
                alert(result.message);
            }
        } catch (e) {
            alert("Punch Failed: " + e.toString());
        } finally {
            this.showLoading(false);
        }
    },

    async loadAdminDashboard() {
        try {
            const resp = await fetch(ATTENDANCE_GAS_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'fetch_all_attendance' })
            });
            const result = await resp.json();
            if (result.success) {
                this.renderAdminTable(result.data);
            }
        } catch (e) {
            console.error("Admin Load Error:", e);
        }
    },

    renderAdminTable(data) {
        const tbody = document.getElementById('adminAttendanceTable');
        tbody.innerHTML = '';

        data.forEach(row => {
            const tr = document.createElement('tr');
            const statusClass = row.status === 'Present' ? 'badge-present' : (row.status === 'Leave' ? 'badge-leave' : 'badge-incomplete');

            const dateObj = new Date(row.date);
            const formattedDate = isNaN(dateObj) ? row.date : dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

            const canEdit = this.user && this.user.username.toLowerCase() === 'abhinand';

            tr.innerHTML = `
                <td><strong>${row.userName}</strong><br><small class="text-muted">${row.userId}</small></td>
                <td>${formattedDate}</td>
                <td>${row.inTime || '--'}</td>
                <td>${row.outTime || '--'}</td>
                <td>${row.duration || '--'}</td>
                <td><span class="badge ${statusClass}">${row.status}</span></td>
                <td>
                    <button class="btn btn-dark btn-sm" onclick="AttendanceApp.viewPhotos('${row.inImage}', '${row.outImage}')">
                        <i class="fas fa-camera"></i>
                    </button>
                </td>
                <td>
                    ${canEdit ? `
                    <button class="btn btn-outline-primary btn-sm" onclick="AttendanceApp.openEditModal('${row.userId}', '${row.userName}', '${row.date}', '${row.inTime}', '${row.outTime}', '${row.status}')">
                        <i class="fas fa-edit"></i>
                    </button>` : `<span class="badge bg-secondary">View Only</span>`}
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    viewPhotos(imgIn, imgOut) {
        console.log("Viewing photos:", { imgIn, imgOut });
        const modalImgIn = document.getElementById('modalImgIn');
        const modalImgOut = document.getElementById('modalImgOut');

        // Helper to convert Drive viewer links to direct display thumbnail links
        const fixUrl = (url) => {
            if (!url || typeof url !== 'string' || url === 'undefined' || url.includes('placehold.co')) return url;

            // If it's a standard Drive share link
            if (url.includes('drive.google.com/file/d/')) {
                const id = url.split('/d/')[1].split('/')[0];
                return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
            }
            // If it's an 'open?id=' link
            if (url.includes('drive.google.com/open?id=')) {
                const id = url.split('id=')[1].split('&')[0];
                return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
            }
            // If it's already a uc?id link, convert to thumbnail for better reliability
            if (url.includes('drive.google.com/uc?')) {
                const id = url.split('id=')[1].split('&')[0];
                return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
            }
            return url;
        };

        const finalIn = fixUrl(imgIn);
        const finalOut = fixUrl(imgOut);

        console.log("Finalized photo URLs:", { finalIn, finalOut });

        modalImgIn.src = finalIn && finalIn !== 'undefined' ? finalIn : 'https://placehold.co/400x300?text=No+Photo';
        modalImgOut.src = finalOut && finalOut !== 'undefined' ? finalOut : 'https://placehold.co/400x300?text=No+Photo';

        const modal = new bootstrap.Modal(document.getElementById('photoModal'));
        modal.show();
    },

    openEditModal(userId, name, date, inT, outT, status) {
        document.getElementById('editUserId').value = userId;
        document.getElementById('editUserName').innerText = name;
        document.getElementById('editDate').value = date;
        document.getElementById('editDateLabel').innerText = date;
        document.getElementById('editInTime').value = inT || '';
        document.getElementById('editOutTime').value = outT || '';
        document.getElementById('editStatus').value = status;

        const modal = new bootstrap.Modal(document.getElementById('editModal'));
        modal.show();
    },

    async handleEditSubmit(e) {
        e.preventDefault();
        const data = {
            action: 'edit_attendance',
            userId: document.getElementById('editUserId').value,
            date: document.getElementById('editDate').value,
            newInTime: document.getElementById('editInTime').value,
            newOutTime: document.getElementById('editOutTime').value,
            newStatus: document.getElementById('editStatus').value,
            adminName: this.user.username
        };

        this.showLoading(true);
        try {
            const resp = await fetch(ATTENDANCE_GAS_URL, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            const result = await resp.json();
            if (result.success) {
                alert(result.message);
                bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
                await this.loadAdminDashboard();
            } else {
                alert(result.message);
            }
        } catch (e) {
            alert("Update Failed: " + e.toString());
        } finally {
            this.showLoading(false);
        }
    },

    bindEvents() {
        document.getElementById('btnPunchIn').addEventListener('click', () => this.handlePunch('IN'));
        document.getElementById('btnPunchOut').addEventListener('click', () => this.handlePunch('OUT'));
        document.getElementById('logoutBtn').addEventListener('click', () => {
            if (typeof AdminManager !== 'undefined') AdminManager.logout();
            else window.location.href = '../../login/';
        });
        document.getElementById('btnRefreshAdmin').addEventListener('click', () => this.loadAdminDashboard());
        document.getElementById('editAttendanceForm').addEventListener('submit', (e) => this.handleEditSubmit(e));
    },

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.style.display = 'flex';
            overlay.style.opacity = '1';
        } else {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.style.display = 'none', 300);
        }
    }
};

window.AttendanceApp = AttendanceApp;

$(document).ready(() => {
    AttendanceApp.init();
});
