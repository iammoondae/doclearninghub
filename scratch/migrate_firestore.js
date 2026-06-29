const firebase = require('firebase/app');
require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCurNjFwsOTL_zjMevhGkojc_pxMDfA6MI",
  authDomain: "doc-learning-hub-web.firebaseapp.com",
  projectId: "doc-learning-hub-web",
  storageBucket: "doc-learning-hub-web.firebasestorage.app",
  messagingSenderId: "148696552118",
  appId: "1:148696552118:web:55be0502a4f3f24423cc17",
  measurementId: "G-1J5XXGBRW4"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

console.log("Starting Firestore migration...");

db.collection('requisitions').get()
  .then(snapshot => {
    const promises = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.status === 'returned') {
        console.log(`Migrating requisition ${doc.id} status from 'returned' to 'returned_for_revision'`);
        promises.push(db.collection('requisitions').doc(doc.id).update({ status: 'returned_for_revision' }));
      }
    });
    
    if (promises.length === 0) {
      console.log("No requisitions with status 'returned' found.");
      return Promise.resolve();
    }
    
    return Promise.all(promises);
  })
  .then(() => {
    console.log("Migration complete!");
    process.exit(0);
  })
  .catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
