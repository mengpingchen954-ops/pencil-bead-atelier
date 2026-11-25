System.register([], function (_export, _context) {
  "use strict";

  var cc, Application;
  function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
  function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
  function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
  function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
  function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
  function _toPrimitive(input, hint) { if (_typeof(input) !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (_typeof(res) !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
  return {
    setters: [],
    execute: function () {
      _export("Application", Application = /*#__PURE__*/function () {
        function Application() {
          _classCallCheck(this, Application);
          this.settingsPath = "data:application/json;base64,eyJDb2Nvc0VuZ2luZSI6IjMuOC4yIiwiZW5naW5lIjp7ImRlYnVnIjpmYWxzZSwicGxhdGZvcm0iOiJ3ZWItbW9iaWxlIiwiY3VzdG9tTGF5ZXJzIjpbXSwic29ydGluZ0xheWVycyI6W10sIm1hY3JvcyI6e30sImJ1aWx0aW5Bc3NldHMiOlsiNjBmNzE5NWMtZWMyYS00NWViLWJhOTQtODk1NWY2MGU4MWQwIiwiMWMwMmFlNmYtNDQ5Mi00OTE1LWI4ZjgtNzQ5MmEzYjFlNGNkIiwiODEwZTk2ZTQtZTQ1Ni00NDY4LTliNTktZjRlOGYzOTczMmMwIiwiZWZlOGUyYTMtZWFjZS00MjdiLWI0ZjEtY2I4YTkzN2VjNzdkIiwiZTlhYTlhM2UtNWIyYi00YWM3LWEyYzctMDczZGUyYjJiMjRmIiwiOGJiZGJjZGQtNWNkNC00MTAwLWI2ZDUtYjdjOTYyNWI2MTA3IiwiNTBmNDM0OGItYzg4My00ZTJmLThmMTEtY2UyMzNiODU5ZmExIiwiZmRhMDk1Y2ItODMxZC00NjAxLWFkOTQtODQ2MDEzOTYzZGU4IiwiZjkyODA2ZDctMTc2OC00NDNmLWFmZTgtMTJiY2RlODRkMGYwIiwiZGQzYTE0NGQtYWI3Zi00MWYwLTgyYjgtMmU0M2EwOTBkNDk2IiwiZjA0MTZlNjgtMDIwMC00Yjc3LWE5MjYtNGY5ZDE2ZTQ5NGRhIiwiOTcwYjA1OTgtYmNiMC00NzE0LTkxZmItMmU4MTQ0MGRjY2Q4IiwiYmNkNjRjYzYtMmRkOS00M2Y2LWFiYmUtNjYzMThkMzMyMDMyIiwiZDkzMDU5MGQtYmI5Mi00Y2M4LThiZDEtMjNjZDAyN2Y5ZWRmIiwiYTNjZDAwOWYtMGFiMC00MjBkLTkyNzgtYjlmZGFiOTM5YmJjIl19LCJhbmltYXRpb24iOnsiY3VzdG9tSm9pbnRUZXh0dXJlTGF5b3V0cyI6W119LCJhc3NldHMiOnsic2VydmVyIjoiIiwicmVtb3RlQnVuZGxlcyI6W10sInN1YnBhY2thZ2VzIjpbXSwicHJlbG9hZEJ1bmRsZXMiOlt7ImJ1bmRsZSI6InJlc291cmNlcyJ9LHsiYnVuZGxlIjoibWFpbiJ9XSwiYnVuZGxlVmVycyI6eyJpbnRlcm5hbCI6IjdmNWQ3IiwibWFpbiI6ImU4NTQ4IiwicmVzb3VyY2VzIjoiNTNlZGEifSwicHJlbG9hZEFzc2V0cyI6W10sInByb2plY3RCdW5kbGVzIjpbImludGVybmFsIiwicmVzb3VyY2VzIiwibWFpbiJdLCJkb3dubG9hZE1heENvbmN1cnJlbmN5IjoxNX0sInBsdWdpbnMiOnsianNMaXN0IjpbXX0sInNjcmlwdGluZyI6eyJzY3JpcHRQYWNrYWdlcyI6WyIuLi9zcmMvY2h1bmtzL2J1bmRsZS4yNTc2NS5qcyJdfSwibGF1bmNoIjp7ImxhdW5jaFNjZW5lIjoiZGI6Ly9hc3NldHMvc2NlbmVzL0xhdW5jaC5zY2VuZSJ9LCJzY3JlZW4iOnsiZXhhY3RGaXRTY3JlZW4iOnRydWUsImRlc2lnblJlc29sdXRpb24iOnsid2lkdGgiOjcyMCwiaGVpZ2h0IjoxMjgwLCJwb2xpY3kiOjJ9LCJvcmllbnRhdGlvbiI6ImF1dG8ifSwicmVuZGVyaW5nIjp7InJlbmRlclBpcGVsaW5lIjoiIn0sInNwbGFzaFNjcmVlbiI6eyJkaXNwbGF5UmF0aW8iOjEsInRvdGFsVGltZSI6MCwibG9nbyI6eyJ0eXBlIjoibm9uZSJ9LCJiYWNrZ3JvdW5kIjp7InR5cGUiOiJjb2xvciIsImNvbG9yIjp7IngiOjAuOTEsInkiOjAuODcsInoiOjAuNzksInciOjF9fSwid2F0ZXJtYXJrTG9jYXRpb24iOiJkZWZhdWx0IiwiYXV0b0ZpdCI6dHJ1ZX0sInBoeXNpY3MiOnsicGh5c2ljc0VuZ2luZSI6IiIsImdyYXZpdHkiOnsieCI6MCwieSI6LTEwLCJ6IjowfSwiYWxsb3dTbGVlcCI6dHJ1ZSwic2xlZXBUaHJlc2hvbGQiOjAuMSwiYXV0b1NpbXVsYXRpb24iOnRydWUsImZpeGVkVGltZVN0ZXAiOjAuMDE2NjY2NywibWF4U3ViU3RlcHMiOjEsImRlZmF1bHRNYXRlcmlhbCI6ImJhMjE0NzZmLTI4NjYtNGY4MS05YzRkLTZlMzU5MzE2ZTQ0OCJ9fQ==";
          this.showFPS = false;
        }
        _createClass(Application, [{
          key: "init",
          value: function init(engine) {
            cc = engine;
            cc.game.onPostBaseInitDelegate.add(this.onPostInitBase.bind(this));
            cc.game.onPostSubsystemInitDelegate.add(this.onPostSystemInit.bind(this));
          }
        }, {
          key: "onPostInitBase",
          value: function onPostInitBase() {
            // cc.settings.overrideSettings('assets', 'server', '');
            // do custom logic
          }
        }, {
          key: "onPostSystemInit",
          value: function onPostSystemInit() {
            // do custom logic
          }
        }, {
          key: "start",
          value: function start() {
            return cc.game.init({
              debugMode: false ? cc.DebugMode.INFO : cc.DebugMode.ERROR,
              settingsPath: this.settingsPath,
              overrideSettings: {
                // assets: {
                //      preloadBundles: [{ bundle: 'main', version: 'xxx' }],
                // }
                profiling: {
                  showFPS: this.showFPS
                }
              }
            }).then(function () {
              return cc.game.run();
            });
          }
        }]);
        return Application;
      }());
    }
  };
});