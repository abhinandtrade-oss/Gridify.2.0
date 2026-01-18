// publishers.js - Board & Publisher profiles
import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const PROFILES_COL = 'profiles';

document.addEventListener('DOMContentLoaded', async () => {
    showLoader('Loading board profiles...');
    await loadProfiles();
    hideLoader();
});

async function loadProfiles() {
    try {
        const profilesRef = collection(db, PROFILES_COL);
        const snapshot = await getDocs(profilesRef);

        const roles = ['Publisher', 'Editorial Director', 'Chief Editor', 'Editor'];
        roles.forEach(role => {
            const container = document.getElementById(`section-${role.replace(/ /g, '-')}`);
            if (container) container.innerHTML = '';
        });

        if (snapshot.empty) {
            return;
        }

        snapshot.forEach(docSnapshot => {
            const profile = docSnapshot.data();
            const container = document.getElementById(`section-${profile.roleType.replace(/ /g, '-')}`);

            if (container) {
                const card = document.createElement('div');
                card.className = 'profile-card';
                // Card click removed. Only button will redirect.

                card.innerHTML = `
                    <img src="${profile.photoUrl || 'https://via.placeholder.com/150'}" alt="${profile.name}" class="profile-photo">
                    <h3 class="profile-name">${profile.name}</h3>
                    <p class="profile-designation">${profile.designation}</p>
                    ${profile.mainProfileLink ? `<a href="${profile.mainProfileLink}" target="_blank" class="profile-btn" onclick="event.stopPropagation()">View Profile</a>` : ''}
                `;
                container.appendChild(card);
            }
        });

    } catch (error) {
        console.error("Error loading profiles:", error);
    }
}
