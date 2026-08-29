import { app, db, auth } from './firebase-config.js';
import { collection, doc, setDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

async function runTest() {
    try {
        console.log("Signing in as staff...");
        await signInWithEmailAndPassword(auth, "staff@goalrefinery.id", "demo123");
        console.log("Signed in as:", auth.currentUser.uid);

        const voucher = {
            id: Date.now(),
            voucherNumber: "BKK-TEST-" + Date.now(),
            type: "BKK",
            date: new Date().toISOString().split('T')[0],
            amount: 500000,
            status: "draft",
            createdBy: auth.currentUser.uid,
            autoPostJournal: true
        };

        const docId = String(voucher.id);
        const docRef = doc(db, 'paymentVouchers', docId);

        console.log("Saving voucher to Firestore...");
        await setDoc(docRef, voucher, { merge: true });
        console.log("Save successful!");

        console.log("Fetching vouchers from Firestore...");
        const snapshot = await getDocs(collection(db, 'paymentVouchers'));
        let found = false;
        snapshot.forEach(d => {
            if (d.id === docId) found = true;
        });

        console.log("Was voucher found in fetch? " + found);

    } catch (e) {
        console.error("Test failed:", e);
    }
}

runTest();
