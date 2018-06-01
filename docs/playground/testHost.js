"use strict";
/// <reference path="../../built/pxtlib.d.ts"/>
var TestHost = /** @class */ (function () {
    function TestHost(name, main, extraDependencies, includeCommon) {
        if (includeCommon === void 0) { includeCommon = false; }
        this.name = name;
        this.main = main;
        this.custom = ' ';
        this.extraDependencies = extraDependencies;
        this.includeCommon = includeCommon;
    }
    TestHost.prototype.resolve = function (module, filename) {
        return "";
    };
    TestHost.prototype.readFile = function (module, filename) {
        if (TestHost.files[module.id] && TestHost.files[module.id][filename]) {
            return TestHost.files[module.id][filename];
        }
        if (module.id == "this") {
            if (filename == "pxt.json") {
                return JSON.stringify({
                    "name": this.name,
                    "dependencies": this.dependencies,
                    "description": "",
                    "files": this.includeCommon ? [
                        "main.blocks",
                        "main.ts",
                        "custom.ts",
                        "pxt-core.d.ts",
                        "pxt-helpers.ts"
                    ] : [
                        "main.blocks",
                        "main.ts",
                        "custom.ts"
                    ]
                });
            }
            else if (filename == "main.ts") {
                return this.main;
            } else if (filename == "custom.ts") {
                return this.custom;
            }
        }
        else if (pxt.appTarget.bundledpkgs[module.id] && filename === pxt.CONFIG_NAME) {
            return pxt.appTarget.bundledpkgs[module.id][pxt.CONFIG_NAME];
        }
        return "";
    };
    TestHost.prototype.writeFile = function (module, filename, contents) {
        if (!TestHost.files[module.id]) {
            TestHost.files[module.id] = {};
        }
        TestHost.files[module.id][filename] = contents;
    };
    TestHost.prototype.getHexInfoAsync = function (extInfo) {
        //console.log(`getHexInfoAsync(${extInfo})`);
        return Promise.resolve(null);
    };
    TestHost.prototype.cacheStoreAsync = function (id, val) {
        //console.log(`cacheStoreAsync(${id}, ${val})`)
        return Promise.resolve();
    };
    TestHost.prototype.cacheGetAsync = function (id) {
        //console.log(`cacheGetAsync(${id})`)
        return Promise.resolve("");
    };
    TestHost.prototype.downloadPackageAsync = function (pkg) {
        //console.log(`downloadPackageAsync(${pkg.id})`)
        return Promise.resolve();
    };
    TestHost.prototype.resolveVersionAsync = function (pkg) {
        //console.log(`resolveVersionAsync(${pkg.id})`)
        return Promise.resolve("*");
    };
    Object.defineProperty(TestHost.prototype, "dependencies", {
        get: function () {
            var stdDeps = {};
            for (var _i = 0, _a = this.extraDependencies; _i < _a.length; _i++) {
                var extraDep = _a[_i];
                stdDeps[extraDep] = "file:../" + extraDep;
            }
            return stdDeps;
        },
        enumerable: true,
        configurable: true
    });
    //Global cache of module files
    TestHost.files = {};
    return TestHost;
}());