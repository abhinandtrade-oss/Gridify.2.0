// manage-profiles.js - Admin Profile Management
import { auth, db, storage } from './firebase-config.js';
import {
    collection,
    getDocs,
    doc,
    getDoc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const PROFILES_COL = 'profiles';

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = '../login.html';
            return;
        }

        const displayEl = document.getElementById('user-display-name');
        if (displayEl) displayEl.textContent = user.email;

        // Check role and toggle admin-only elements
        getDoc(doc(db, 'users', user.email)).then(snap => {
            if (!snap.exists()) {
                signOut(auth).then(() => window.location.href = '../login.html');
                return;
            }
            const userData = snap.data();
            if (userData.role === 'admin') {
                document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'inline-flex');
            }
        });

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = () => signOut(auth).then(() => location.href = '../login.html');
        }

        showLoader('Loading profiles...');
        loadProfiles();
    });

    const profileForm = document.getElementById('profile-form');
    const photoInput = document.getElementById('profile-photo');
    const photoPreview = document.getElementById('photo-preview');
    const cancelBtn = document.getElementById('cancel-edit');

    if (photoInput && photoPreview) {
        photoInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    photoPreview.src = e.target.result;
                    photoPreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        };
    }

    if (profileForm) {
        profileForm.onsubmit = async (e) => {
            e.preventDefault();
            saveProfile();
        };
    }

    if (cancelBtn) {
        cancelBtn.onclick = resetForm;
    }
});

async function loadProfiles() {
    const list = document.getElementById('profiles-list');
    if (!list) return;
    list.innerHTML = 'Loading profiles...';

    try {
        const snapshot = await getDocs(collection(db, PROFILES_COL));
        list.innerHTML = '';

        if (snapshot.empty) {
            list.innerHTML = '<p>No profiles added yet.</p>';
            return;
        }

        snapshot.forEach(docSnapshot => {
            const profile = docSnapshot.data();
            const id = docSnapshot.id;

            const div = document.createElement('div');
            div.className = 'profile-item';
            div.innerHTML = `
                <img src="${profile.photoUrl || 'https://via.placeholder.com/80'}" alt="${profile.name}">
                <h4>${profile.name}</h4>
                <p>${profile.designation}<br><b>${profile.roleType}</b></p>
                <div class="profile-actions">
                    <button onclick="editProfile('${id}')" class="btn btn-primary" style="background:#eee; color:#333; font-size: 0.8rem;">Edit</button>
                    <button onclick="deleteProfile('${id}')" class="btn" style="background:#fee; color:#d9534f; font-size: 0.8rem;">Delete</button>
                </div>
            `;
            list.appendChild(div);
        });
    } catch (error) {
        console.error("Load error:", error);
    } finally {
        hideLoader();
    }
}

async function saveProfile() {
    const id = document.getElementById('profile-id').value;
    const name = document.getElementById('profile-name').value;
    const designation = document.getElementById('profile-designation').value;
    const roleType = document.getElementById('profile-role').value;
    const mainProfileLink = document.getElementById('profile-link').value;
    const photoFile = document.getElementById('profile-photo').files[0];

    try {
        showLoader('Saving profile...');
        let photoUrl = null;

        if (photoFile) {
            // Convert file to Base64 to save directly in Firestore
            photoUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(photoFile);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
        }

        const profileData = {
            name,
            designation,
            roleType,
            mainProfileLink,
            updatedAt: serverTimestamp()
        };

        if (photoUrl) {
            profileData.photoUrl = photoUrl;
        }

        if (id) {
            await updateDoc(doc(db, PROFILES_COL, id), profileData);
        } else {
            await addDoc(collection(db, PROFILES_COL), profileData);
        }

        alert("Profile saved!");
        resetForm();
        loadProfiles();
    } catch (error) {
        console.error("Error saving profile:", error);
        alert("Error saving: " + error.message);
    } finally {
        hideLoader();
    }
}

window.editProfile = async function (id) {
    const docRef = doc(db, PROFILES_COL, id);
    const docSnap = await getDoc(docRef);
    const data = docSnap.data();

    document.getElementById('profile-id').value = id;
    document.getElementById('profile-name').value = data.name;
    document.getElementById('profile-designation').value = data.designation;
    document.getElementById('profile-role').value = data.roleType;
    document.getElementById('profile-link').value = data.mainProfileLink || '';

    if (data.photoUrl) {
        const preview = document.getElementById('photo-preview');
        preview.src = data.photoUrl;
        preview.style.display = 'block';
    }

    document.getElementById('form-title').textContent = "Edit Profile";
    document.getElementById('cancel-edit').style.display = 'block';
}

window.deleteProfile = async function (id) {
    if (confirm("Delete this profile?")) {
        showLoader('Deleting profile...');
        try {
            await deleteDoc(doc(db, PROFILES_COL, id));
            loadProfiles();
        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            hideLoader();
        }
    }
}

function resetForm() {
    const form = document.getElementById('profile-form');
    if (form) form.reset();
    document.getElementById('profile-link').value = '';
    document.getElementById('profile-id').value = '';
    document.getElementById('photo-preview').style.display = 'none';
    document.getElementById('form-title').textContent = "Add New Profile";
    document.getElementById('cancel-edit').style.display = 'none';
}
