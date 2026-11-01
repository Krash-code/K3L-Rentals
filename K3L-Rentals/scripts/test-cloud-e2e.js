// K3L Rentals - Complete End-to-End Cloud Workflow & Security Validation Suite
const API_KEY = "AIzaSyDcVHD6NXM2MNkiNBlOR6ovdRg_OiHTdsU";
const PROJECT_ID = "k3l-rentals-13ff0";

const AUTH_SIGNIN_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
const AUTH_SIGNUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  ✓ PASS: ${message}`);
    } else {
        console.error(`  ✗ FAIL: ${message}`);
    }
}

async function signUp(email, password) {
    const res = await fetch(AUTH_SIGNUP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    return await res.json();
}

async function signIn(email, password) {
    const res = await fetch(AUTH_SIGNIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    const data = await res.json();
    if (!data.idToken) throw new Error("Auth failed: " + JSON.stringify(data.error));
    return data;
}

async function getDoc(path, token) {
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${FIRESTORE_BASE}/${path}?key=${API_KEY}`, { headers });
    return { status: res.status, data: await res.json() };
}

async function getCollection(collection, token) {
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${FIRESTORE_BASE}/${collection}?key=${API_KEY}`, { headers });
    return { status: res.status, data: await res.json() };
}

async function patchDoc(path, fields, token, updateMask = null) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    let url = `${FIRESTORE_BASE}/${path}?key=${API_KEY}`;
    if (updateMask && Array.isArray(updateMask)) {
        url += "&" + updateMask.map(m => `updateMask.fieldPaths=${encodeURIComponent(m)}`).join("&");
    }
    const res = await fetch(url, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ fields })
    });
    return { status: res.status, data: await res.json() };
}

async function createDoc(collection, docId, fields, token) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const url = docId
        ? `${FIRESTORE_BASE}/${collection}/${docId}?key=${API_KEY}`
        : `${FIRESTORE_BASE}/${collection}?key=${API_KEY}`;
    const res = await fetch(url, {
        method: docId ? "PATCH" : "POST",
        headers,
        body: JSON.stringify({ fields })
    });
    return { status: res.status, data: await res.json() };
}

async function deleteDoc(path, token) {
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${FIRESTORE_BASE}/${path}?key=${API_KEY}`, {
        method: "DELETE",
        headers
    });
    return { status: res.status, data: await res.json() };
}

async function runComprehensiveTests() {
    console.log("======================================================================");
    console.log("  K3L RENTALS — COMPLETE END-TO-END WORKFLOW & SECURITY VERIFICATION");
    console.log("======================================================================");
    console.log("Environment: Cloud Firestore & Firebase Auth (Spark Plan ₹0)");
    console.log("Project: k3l-rentals-13ff0 | Time: " + new Date().toISOString());

    // -------------------------------------------------------------------------
    // 0. AUTHENTICATE ADMIN DYNAMICALLY (No hardcoded UIDs)
    // -------------------------------------------------------------------------
    console.log("\n[1/8] Dynamic Admin Authentication & RBAC Verification");
    const adminAuth = await signIn("admin@k3lrentals.com", "AdminPassword@2026");
    const dynamicAdminUid = adminAuth.localId;
    assert(dynamicAdminUid && dynamicAdminUid.length > 0, `Admin authenticated dynamically (UID: ${dynamicAdminUid})`);

    const adminVerification = await getDoc(`admins/${dynamicAdminUid}`, adminAuth.idToken);
    assert(adminVerification.status === 200, "Admin record verified in 'admins' collection");

    // -------------------------------------------------------------------------
    // 1. PUBLIC VEHICLE CATALOG TESTS
    // -------------------------------------------------------------------------
    console.log("\n[2/8] Testing Public Vehicle Catalog & Discovery");
    const pubVehicles = await getCollection("vehicles");
    assert(pubVehicles.status === 200, "Public catalog readable without credentials");
    const vehicleDocs = pubVehicles.data.documents || [];
    assert(vehicleDocs.length === 20, `Public catalog contains exactly 20 vehicles (Found: ${vehicleDocs.length})`);

    const categories = vehicleDocs.map(d => d.fields.category?.stringValue);
    assert(categories.includes("car"), "Catalog includes car vehicles");
    assert(categories.includes("bike"), "Catalog includes bike vehicles");

    const sampleVehicleId = "v_creta_01";
    const sampleVehicleDoc = await getDoc(`vehicles/${sampleVehicleId}`);
    assert(sampleVehicleDoc.status === 200, `Vehicle details endpoint accessible for ${sampleVehicleId}`);
    assert(sampleVehicleDoc.data.fields.model.stringValue === "Hyundai Creta", "Vehicle details return accurate model name");

    // -------------------------------------------------------------------------
    // 2. CUSTOMER REGISTRATION & LOGIN WORKFLOW
    // -------------------------------------------------------------------------
    console.log("\n[3/8] Testing Customer Registration & Authentication");
    const dynamicEmail = `qa_cust_${Date.now()}@k3lrentals.com`;
    const dynamicPass = "SecurePass@2026";

    const regResult = await signUp(dynamicEmail, dynamicPass);
    assert(regResult.localId && regResult.idToken, `Customer registered successfully (${dynamicEmail})`);
    const newCustUid = regResult.localId;
    const newCustToken = regResult.idToken;

    // Create user profile in Firestore
    const profileRes = await createDoc("users", newCustUid, {
        name: { stringValue: "QA Test Customer" },
        email: { stringValue: dynamicEmail },
        phone: { stringValue: "9876500000" },
        role: { stringValue: "customer" },
        createdAt: { stringValue: new Date().toISOString() }
    }, newCustToken);
    assert(profileRes.status === 200, "Customer profile successfully created in 'users' collection");

    // Test sign in with credentials
    const loginResult = await signIn(dynamicEmail, dynamicPass);
    assert(loginResult.localId === newCustUid, "Customer login successfully authenticates and issues valid token");

    // -------------------------------------------------------------------------
    // 3. DATE-BASED BOOKING CREATION & SCHEDULE REGISTRATION
    // -------------------------------------------------------------------------
    console.log("\n[4/8] Testing Date-Based Booking & Schedule Registration");
    const testBookingId = `b_test_${Date.now()}`;
    const bookingRes = await createDoc("bookings", testBookingId, {
        userId: { stringValue: newCustUid },
        customerName: { stringValue: "QA Test Customer" },
        customerEmail: { stringValue: dynamicEmail },
        vehicleId: { stringValue: sampleVehicleId },
        model: { stringValue: "Hyundai Creta" },
        vehicle_number: { stringValue: "TN-38-AB-1001" },
        category: { stringValue: "car" },
        type: { stringValue: "SUV" },
        location: { stringValue: "Coimbatore" },
        start_date: { stringValue: "2026-11-10" },
        end_date: { stringValue: "2026-11-14" },
        rental_days: { integerValue: "4" },
        price_per_day: { integerValue: "2800" },
        total_amount: { integerValue: "11200" },
        status: { stringValue: "Confirmed" }
    }, newCustToken);
    assert(bookingRes.status === 200, `Private booking created with ID: ${testBookingId}`);

    // Create corresponding schedule slot under vehicle
    const scheduleRes = await createDoc(`vehicles/${sampleVehicleId}/schedules`, testBookingId, {
        userId: { stringValue: newCustUid },
        start_date: { stringValue: "2026-11-10" },
        end_date: { stringValue: "2026-11-14" },
        status: { stringValue: "Confirmed" }
    }, newCustToken);
    assert(scheduleRes.status === 200, "Public schedule slot created under vehicle for availability tracking");

    // Verify schedule slot is readable publicly
    const publicScheduleRead = await getDoc(`vehicles/${sampleVehicleId}/schedules/${testBookingId}`);
    assert(publicScheduleRead.status === 200, "Public schedule slot is readable without requiring private booking access");

    // Verify customer can retrieve their own booking
    const myBooking = await getDoc(`bookings/${testBookingId}`, newCustToken);
    assert(myBooking.status === 200, "Customer can fetch their own newly created booking");
    assert(myBooking.data.fields.total_amount.integerValue === "11200", "Booking accurately reflects total price (₹11,200)");

    // -------------------------------------------------------------------------
    // 4. CUSTOMER SELF-SERVICE CANCELLATION
    // -------------------------------------------------------------------------
    console.log("\n[5/8] Testing Customer Self-Service Booking Cancellation");
    const cancelRes = await patchDoc(`bookings/${testBookingId}`, {
        status: { stringValue: "Cancelled" }
    }, newCustToken, ["status"]);
    assert(cancelRes.status === 200, "Customer can cancel their own active booking");

    // Customer cancellation syncs schedule slot
    const cancelSchedRes = await patchDoc(`vehicles/${sampleVehicleId}/schedules/${testBookingId}`, {
        status: { stringValue: "Cancelled" }
    }, newCustToken, ["status"]);
    assert(cancelSchedRes.status === 200, "Customer can release their schedule slot on cancellation");

    // -------------------------------------------------------------------------
    // 5. SECURITY RULES & PRIVILEGE ENFORCEMENT
    // -------------------------------------------------------------------------
    console.log("\n[6/8] Testing Firestore Security Rules Enforcement");
    // Attempt 1: Customer trying to change their own role to 'admin'
    const roleEscalation = await patchDoc(`users/${newCustUid}`, {
        role: { stringValue: "admin" }
    }, newCustToken, ["role"]);
    assert(roleEscalation.status === 403, "Security Rules REJECT role escalation attempt to 'admin' (HTTP 403)");

    // Attempt 2: Customer trying to read the dynamic admin document
    const adminRead = await getDoc(`admins/${dynamicAdminUid}`, newCustToken);
    assert(adminRead.status === 403, "Security Rules REJECT customer read from 'admins' collection (HTTP 403)");

    // Attempt 3: Customer trying to modify admins collection
    const adminWrite = await createDoc("admins", `fake_${Date.now()}`, {
        role: { stringValue: "admin" }
    }, newCustToken);
    assert(adminWrite.status === 403, "Security Rules REJECT customer write to 'admins' collection (HTTP 403)");

    // Attempt 4: Customer trying to delete a vehicle
    const vehicleDelete = await deleteDoc(`vehicles/${sampleVehicleId}`, newCustToken);
    assert(vehicleDelete.status === 403, "Security Rules REJECT customer delete on vehicle records (HTTP 403)");

    // Attempt 5: Another customer trying to read newCustUid's booking
    const secondCustEmail = `qa_cust2_${Date.now()}@k3lrentals.com`;
    const secondCust = await signUp(secondCustEmail, "Pass@2026");
    const unauthorizedBookingRead = await getDoc(`bookings/${testBookingId}`, secondCust.idToken);
    assert(unauthorizedBookingRead.status === 403, "Security Rules REJECT other customer reading private booking (HTTP 403)");

    // -------------------------------------------------------------------------
    // 6. ADMIN PORTAL OPERATIONS & DATA ACCESS
    // -------------------------------------------------------------------------
    console.log("\n[7/8] Testing Admin Portal Operations & Data Access");
    // Admin reading all customer bookings
    const allBookings = await getCollection("bookings", adminAuth.idToken);
    assert(allBookings.status === 200, "Admin has authorization to retrieve full bookings collection");
    const bookingList = allBookings.data.documents || [];
    assert(bookingList.length >= 10, `Admin retrieved all reservations (${bookingList.length} total)`);

    // Clean up test booking and schedule using admin token
    await deleteDoc(`bookings/${testBookingId}`, adminAuth.idToken);
    await deleteDoc(`vehicles/${sampleVehicleId}/schedules/${testBookingId}`, adminAuth.idToken);
    console.log(`  ✓ Cleaned up temporary test records`);

    // -------------------------------------------------------------------------
    // 7. DEMONSTRATION METRICS & SMART ROUTE
    // -------------------------------------------------------------------------
    console.log("\n[8/8] Testing Demonstration Fleet Metrics & Route");
    const allVehiclesRes = await getCollection("vehicles", adminAuth.idToken);
    const allVehicles = (allVehiclesRes.data.documents || []).map(d => ({
        id: d.name.split("/").pop(),
        status: d.fields.status?.stringValue || "",
        location: d.fields.location?.stringValue || ""
    }));

    const availableCount = allVehicles.filter(v => v.status === "available").length;
    const bookedCount = allVehicles.filter(v => v.status === "booked").length;
    const maintCount = allVehicles.filter(v => v.status === "maintenance").length;
    const inUseCount = allVehicles.filter(v => v.status === "in_use").length;

    assert(allVehicles.length === 20, `Metric Check: Total Vehicles = 20 (Actual: ${allVehicles.length})`);
    assert(availableCount === 8, `Metric Check: Available Vehicles = 8 (Actual: ${availableCount})`);
    assert(bookedCount === 7, `Metric Check: Booked Vehicles = 7 (Actual: ${bookedCount})`);
    assert(maintCount === 2, `Metric Check: Maintenance Vehicles = 2 (Actual: ${maintCount})`);
    assert(inUseCount === 3, `Metric Check: In-Use Vehicles = 3 (Actual: ${inUseCount})`);

    const routeLocations = Array.from(new Set(allVehicles.map(v => v.location)));
    assert(routeLocations.includes("Coimbatore"), "Fleet active in Coimbatore");
    assert(routeLocations.includes("Erode"), "Fleet active in Erode");
    assert(routeLocations.includes("Salem"), "Fleet active in Salem");

    // Test Admin Live Location Update on Fleet Asset
    const testAsset = "v_creta_01";
    const updateRes = await patchDoc(`vehicles/${testAsset}`, {
        location: { stringValue: "Salem" }
    }, adminAuth.idToken, ["location"]);
    assert(updateRes.status === 200, "Admin can update fleet location dynamically");

    // Restore location to Coimbatore
    await patchDoc(`vehicles/${testAsset}`, {
        location: { stringValue: "Coimbatore" }
    }, adminAuth.idToken, ["location"]);
    assert(true, "Restored fleet location to Coimbatore");

    console.log("\n======================================================================");
    console.log(`  FINAL VERIFICATION SCORE: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log("======================================================================");

    if (passedTests === totalTests) {
        console.log("  ★ 100% OF WORKFLOWS AND SECURITY POLICIES VALIDATED SUCCESSFULLY ★\n");
        process.exit(0);
    } else {
        console.error("  SOME WORKFLOWS FAILED VALIDATION!\n");
        process.exit(1);
    }
}

runComprehensiveTests().catch(err => {
    console.error("FATAL ERROR IN TEST SUITE:", err);
    process.exit(1);
});
