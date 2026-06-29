// scratch/test_load.js
// Mock browser environment to test app.js and lims.js loading

const fs = require('fs');
const path = require('path');

// Mock window and document
global.window = global;
global.document = {
  getElementById: (id) => {
    return {
      style: {},
      innerHTML: '',
      addEventListener: () => {},
      classList: {
        add: () => {},
        remove: () => {}
      }
    };
  },
  querySelectorAll: () => [],
  addEventListener: () => {}
};

global.localStorage = {
  getItem: () => null,
  setItem: () => {}
};

global.navigator = {
  userAgent: 'node'
};

// Mock firebase
global.firebase = {
  initializeApp: () => {},
  auth: () => ({
    onAuthStateChanged: () => {}
  }),
  firestore: () => ({
    collection: () => ({
      doc: () => ({
        get: () => Promise.resolve({ exists: false, data: () => ({}) }),
        set: () => Promise.resolve()
      }),
      get: () => Promise.resolve([])
    })
  })
};
global.firestore = global.firebase.firestore();

// Mock Audio
global.Audio = class {
  play() {}
};

// Mock XLSX
global.XLSX = {
  utils: {
    book_new: () => ({}),
    aoa_to_sheet: () => ({}),
    book_append_sheet: () => {}
  },
  writeFile: () => {}
};

try {
  // Read and execute app.js
  const appJsCode = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  eval(appJsCode);
  console.log("app.js parsed and executed successfully in mock environment!");

  // Read and execute lims.js
  const limsJsCode = fs.readFileSync(path.join(__dirname, '../lims.js'), 'utf8');
  eval(limsJsCode);
  console.log("lims.js parsed and executed successfully in mock environment!");

  // Test calling one of the views
  global.currentUser = { email: 'custodian@msugensan.edu.ph', name: 'Custodian', role: 'laboratory' };
  global.currentUserRole = 'laboratory';
  
  if (typeof global.renderLabTransactionsView === 'function') {
    global.renderLabTransactionsView();
    console.log("renderLabTransactionsView() executed successfully!");
  } else {
    console.error("renderLabTransactionsView is NOT a function!");
  }
} catch (err) {
  console.error("Execution failed:", err);
}
