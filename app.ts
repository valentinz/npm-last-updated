#!/usr/bin/env node

import * as cmd from "node-cmd";
import * as RegClient from "silent-npm-registry-client";
import * as Promise from "promise";
import * as Table from "cli-table";


class NpmLastUpdated {

    public static main(): void {
        cmd.get("npm list --json", (err, data) => {
            if (err !== null) {
                console.error("Unable to read npm package list.", err);
                return;
            }

            let packageDependencies = JSON.parse(data);
            let modules: Array<NodeModule> = [];
            NpmLastUpdated.handleDependencies(packageDependencies.dependencies, modules);

            let promises = modules.map(
                (module) => NpmLastUpdated.findPublishedDateOfPackage(module)
                    .then((result: Date) => {
                        module.releaseDate = result;
                        return module;
                    })
                    .catch((error) => {
                        console.error(error);
                    })
            );
            Promise.all(promises)
                .then((modules: Array<NodeModule>) => {
                    modules = modules.sort(NpmLastUpdated.sortByReleaseDate);
                    modules.length = 10;
                    NpmLastUpdated.printModules(modules);
                });
            if (promises.length == 0) {
                console.log("No modules found.");
            }


        });
    }

    private static sortByReleaseDate(a: NodeModule, b: NodeModule) {
        if (a.releaseDate == b.releaseDate) {
            return 0;
        } else if (a.releaseDate < b.releaseDate) {
            return 1;
        }
        return -1;
    }


    private static handleDependencies(dependencies: { [name: string]: Dependency }, modules: Array<NodeModule>) {
        for (let dependencyName in dependencies) {
            let dependency = dependencies[dependencyName];
            let version = dependency.version;
            modules.push(new NodeModule(dependencyName, version));
            NpmLastUpdated.handleDependencies(dependency.dependencies, modules);
        }
    }

    private static findPublishedDateOfPackage(module: NodeModule) {
        // TODO make it configurable from command line
        let config = {};
        let client = new RegClient(config);

        let params = {timeout: 1000};

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

    private static printModules(modules) {
        let table = new Table({
            head: ['Name', 'Version', 'Release Date'],
            colWidths: [40, 15, 30],
            chars: {'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''}
        });

        let tableItems = modules.map((module) => [module.name, module.version, module.releaseDate.toISOString()]);
        table.push(...tableItems);
        console.log(table.toString());
    }

}

NpmLastUpdated.main();


interface Dependency {
    version: string;
    dependencies: { [name: string]: Dependency };
}

class NodeModule {
    private _name: string;
    private _version: string;
    private _releaseDate: Date;

    constructor(name: string, version: string) {
        this._name = name;
        this._version = version;
    }

    get name(): string {
        return this._name;
    }

    get version(): string {
        return this._version;
    }

    get releaseDate(): Date {
        return this._releaseDate;
    }

    set releaseDate(value: Date) {
        this._releaseDate = value;
    }

}