"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const definitionProviderBase_1 = require("./definitionProviderBase");
class TypeScriptTypeDefinitionProvider extends definitionProviderBase_1.default {
    constructor(client) {
        super(client);
    }
    provideTypeDefinition(document, position, token) {
        return this.getSymbolLocations('typeDefinition', document, position, token);
    }
}
exports.default = TypeScriptTypeDefinitionProvider;
//# sourceMappingURL=https://ticino.blob.core.windows.net/sourcemaps/27492b6bf3acb0775d82d2f87b25a93490673c6d/extensions/typescript/out/features/typeDefinitionProvider.js.map
