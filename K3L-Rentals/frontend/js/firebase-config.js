
const firebaseConfig = {
  apiKey: "AIzaSyDcVHD6NXM2MNkiNBlOR6ovdRg_OiHTdsU",
  authDomain: "k3l-rentals-13ff0.firebaseapp.com",
  projectId: "k3l-rentals-13ff0",
  storageBucket: "k3l-rentals-13ff0.firebasestorage.app",
  messagingSenderId: "524006419697",
  appId: "1:524006419697:web:90bf660d75a66c95290d50",
  measurementId: "G-SH2R5NEF00"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
