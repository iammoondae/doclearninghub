// scratch/test_lims_gjs.js
// Mock browser environment and load app.js / lims.js using gjs

const Gio = imports.gi.Gio;

function read_file(path) {
  let file = Gio.File.new_for_path(path);
  let [success, contents] = file.load_contents(null);
  if (!success) throw new Error("Failed to read file: " + path);
  // In gjs, contents is a Uint8Array, convert to string
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder("utf-8").decode(contents);
  } else {
    // Fallback: convert manually or via Gio
    return String.fromCharCode.apply(null, contents);
  }
}

// Mock window and document
globalThis.window = globalThis;
globalThis.localStorage = {
  getItem: function() { return null; },
  setItem: function() {}
};
globalThis.document = {
  getElementById: function(id) {
    return {
      style: {},
      innerHTML: '',
      addEventListener: function() {},
      classList: {
        add: function() {},
        remove: function() {}
      }
    };
  },
  querySelectorAll: function() { return []; },
  querySelector: function() { return null; },
  createElement: function() { return { src: '', onload: function() {}, onerror: function() {} }; },
  head: { appendChild: function() {} },
  addEventListener: function() {}
};
globalThis.atob = function(str) { return ''; };
globalThis.btoa = function(str) { return ''; };
globalThis.addEventListener = function() {};

globalThis.navigator = {
  userAgent: 'gjs'
};

// Mock Audio
globalThis.Audio = class {
  play() {}
};

// Mock firebase
globalThis.firebase = {
  initializeApp: function() {},
  auth: function() {
    return {
      onAuthStateChanged: function() {}
    };
  },
  storage: function() {
    return {
      ref: function() {
        return {
          child: function() {
            return {
              getDownloadURL: function() { return Promise.resolve(''); }
            };
          }
        };
      }
    };
  },
  firestore: function() {
    return {
      collection: function() {
        return {
          doc: function() {
            return {
              get: function() {
                return {
                  then: function() { return { catch: function() {} }; }
                };
              },
              set: function() {
                return {
                  then: function() { return { catch: function() {} }; }
                };
              }
            };
          },
          get: function() {
            return {
              then: function() { return { catch: function() {} }; }
            };
          }
        };
      },
      enablePersistence: function() {
        return {
          catch: function() {}
        };
      }
    };
  }
};
globalThis.firestore = globalThis.firebase.firestore();

// Mock XLSX
globalThis.XLSX = {
  utils: {
    book_new: function() { return {}; },
    aoa_to_sheet: function() { return {}; },
    book_append_sheet: function() {}
  },
  writeFile: function() {}
};

try {
  let appJs = read_file("app.js");
  // Evaluate app.js
  eval(appJs);
  print("app.js parsed and evaluated successfully in gjs!");

  let limsJs = read_file("lims.js");
  // Evaluate lims.js
  eval(limsJs);
  print("lims.js parsed and evaluated successfully in gjs!");

  // Mock a user session and test calling renderLabTransactionsView
  globalThis.currentUser = { email: 'custodian@msugensan.edu.ph', name: 'Custodian', role: 'laboratory' };
  globalThis.currentUserRole = 'laboratory';

  if (typeof globalThis.renderLabTransactionsView === 'function') {
    globalThis.renderLabTransactionsView();
    print("renderLabTransactionsView() executed successfully in gjs!");
  } else {
    print("Error: renderLabTransactionsView is NOT a function!");
  }

} catch (err) {
  print("Error executing script: " + err + "\n" + err.stack);
}
