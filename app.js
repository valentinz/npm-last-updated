#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cmd = require("node-cmd");
const RegClient = require("silent-npm-registry-client");
const Promise = require("promise");
const Table = require("cli-table");
class NpmLastUpdated {
    static main() {
        cmd.get("npm list --json", (err, data) => {
            if (err !== null) {
                console.error("Unable to read npm package list.", err);
                return;
            }
            let packageDependencies = JSON.parse(data);
            let modules = [];
            NpmLastUpdated.handleDependencies(packageDependencies.dependencies, modules);
            let promises = modules.map((module) => NpmLastUpdated.findPublishedDateOfPackage(module)
                .then((result) => {
                module.releaseDate = result;
                return module;
            })
                .catch((error) => {
                console.error(error);
            }));
            Promise.all(promises)
                .then((modules) => {
                modules = modules.sort(NpmLastUpdated.sortByReleaseDate);
                modules.length = 10;
                NpmLastUpdated.printModules(modules);
            });
            if (promises.length == 0) {
                console.log("No modules found.");
            }
        });
    }
    static sortByReleaseDate(a, b) {
        if (a.releaseDate == b.releaseDate) {
            return 0;
        }
        else if (a.releaseDate < b.releaseDate) {
            return 1;
        }
        return -1;
    }
    static handleDependencies(dependencies, modules) {
        for (let dependencyName in dependencies) {
            let dependency = dependencies[dependencyName];
            let version = dependency.version;
            modules.push(new NodeModule(dependencyName, version));
            NpmLastUpdated.handleDependencies(dependency.dependencies, modules);
        }
    }
    static findPublishedDateOfPackage(module) {
        // TODO make it configurable from command line
        let config = {};
        let client = new RegClient(config);
        let params = { timeout: 1000 };
        return new Promise((resolve, reject) => {
            let uri = `https://registry.npmjs.org/${module.name}`;
            client.get(uri, params, (error, data) => {
                if (error !== null) {
                    reject(error);
                    return;
                }
                resolve(new Date(data.time[module.version]));
            });
        });
    }
    static printModules(modules) {
        let table = new Table({
            head: ['Name', 'Version', 'Release Date'],
            colWidths: [40, 15, 30],
            chars: { 'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' }
        });
        let tableItems = modules.map((module) => [module.name, module.version, module.releaseDate.toISOString()]);
        table.push(...tableItems);
        console.log(table.toString());
    }
}
NpmLastUpdated.main();
class NodeModule {
    constructor(name, version) {
        this._name = name;
        this._version = version;
    }
    get name() {
        return this._name;
    }
    get version() {
        return this._version;
    }
    get releaseDate() {
        return this._releaseDate;
    }
    set releaseDate(value) {
        this._releaseDate = value;
    }
}
