// Firebase Configuration for K3L Rentals
const firebaseConfig = {
  apiKey: "AIzaSyDcVHD6NXM2MNkiNBlOR6ovdRg_OiHTdsU",
  authDomain: "k3l-rentals-13ff0.firebaseapp.com",
  projectId: "k3l-rentals-13ff0",
  storageBucket: "k3l-rentals-13ff0.firebasestorage.app",
  messagingSenderId: "524006419697",
  appId: "1:524006419697:web:90bf660d75a66c95290d50",
  measurementId: "G-SH2R5NEF00"
};

// Initialize Firebase once
if (typeof firebase !== "undefined" && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Provide shared global references
window.auth = typeof firebase !== "undefined" ? firebase.auth() : null;
window.db = typeof firebase !== "undefined" ? firebase.firestore() : null;
var auth = window.auth;
var db = window.db;
