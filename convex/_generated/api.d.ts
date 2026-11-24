/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audit from "../audit.js";
import type * as blueprintBootstrap from "../blueprintBootstrap.js";
import type * as blueprints from "../blueprints.js";
import type * as learning from "../learning.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_blueprintBootstrap from "../lib/blueprintBootstrap.js";
import type * as lib_blueprintFixture from "../lib/blueprintFixture.js";
import type * as lib_blueprintValidation from "../lib/blueprintValidation.js";
import type * as lib_blueprints from "../lib/blueprints.js";
import type * as lib_learning from "../lib/learning.js";
import type * as lib_preparation from "../lib/preparation.js";
import type * as lib_questionAssetMetadata from "../lib/questionAssetMetadata.js";
import type * as lib_questionAssetUpload from "../lib/questionAssetUpload.js";
import type * as lib_questionAssets from "../lib/questionAssets.js";
import type * as lib_questionContent from "../lib/questionContent.js";
import type * as lib_questionImage from "../lib/questionImage.js";
import type * as lib_questionImportProtocol from "../lib/questionImportProtocol.js";
import type * as lib_questionImportState from "../lib/questionImportState.js";
import type * as lib_questionImports from "../lib/questionImports.js";
import type * as lib_questionLifecycle from "../lib/questionLifecycle.js";
import type * as lib_questionReferenceDrafts from "../lib/questionReferenceDrafts.js";
import type * as lib_questionServing from "../lib/questionServing.js";
import type * as lib_questionWorkflow from "../lib/questionWorkflow.js";
import type * as lib_seedBootstrapFixture from "../lib/seedBootstrapFixture.js";
import type * as lib_seedBootstrapProtocol from "../lib/seedBootstrapProtocol.js";
import type * as lib_taxonomy from "../lib/taxonomy.js";
import type * as lib_taxonomyBootstrap from "../lib/taxonomyBootstrap.js";
import type * as lib_taxonomyCatalog from "../lib/taxonomyCatalog.js";
import type * as lib_userAccess from "../lib/userAccess.js";
import type * as questionAssetActions from "../questionAssetActions.js";
import type * as questionAssets from "../questionAssets.js";
import type * as questionImportActions from "../questionImportActions.js";
import type * as questionImports from "../questionImports.js";
import type * as questionReferences from "../questionReferences.js";
import type * as questions from "../questions.js";
import type * as referenceData from "../referenceData.js";
import type * as seedBootstrap from "../seedBootstrap.js";
import type * as taxonomyBootstrap from "../taxonomyBootstrap.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  audit: typeof audit;
  blueprintBootstrap: typeof blueprintBootstrap;
  blueprints: typeof blueprints;
  learning: typeof learning;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/blueprintBootstrap": typeof lib_blueprintBootstrap;
  "lib/blueprintFixture": typeof lib_blueprintFixture;
  "lib/blueprintValidation": typeof lib_blueprintValidation;
  "lib/blueprints": typeof lib_blueprints;
  "lib/learning": typeof lib_learning;
  "lib/preparation": typeof lib_preparation;
  "lib/questionAssetMetadata": typeof lib_questionAssetMetadata;
  "lib/questionAssetUpload": typeof lib_questionAssetUpload;
  "lib/questionAssets": typeof lib_questionAssets;
  "lib/questionContent": typeof lib_questionContent;
  "lib/questionImage": typeof lib_questionImage;
  "lib/questionImportProtocol": typeof lib_questionImportProtocol;
  "lib/questionImportState": typeof lib_questionImportState;
  "lib/questionImports": typeof lib_questionImports;
  "lib/questionLifecycle": typeof lib_questionLifecycle;
  "lib/questionReferenceDrafts": typeof lib_questionReferenceDrafts;
  "lib/questionServing": typeof lib_questionServing;
  "lib/questionWorkflow": typeof lib_questionWorkflow;
  "lib/seedBootstrapFixture": typeof lib_seedBootstrapFixture;
  "lib/seedBootstrapProtocol": typeof lib_seedBootstrapProtocol;
  "lib/taxonomy": typeof lib_taxonomy;
  "lib/taxonomyBootstrap": typeof lib_taxonomyBootstrap;
  "lib/taxonomyCatalog": typeof lib_taxonomyCatalog;
  "lib/userAccess": typeof lib_userAccess;
  questionAssetActions: typeof questionAssetActions;
  questionAssets: typeof questionAssets;
  questionImportActions: typeof questionImportActions;
  questionImports: typeof questionImports;
  questionReferences: typeof questionReferences;
  questions: typeof questions;
  referenceData: typeof referenceData;
  seedBootstrap: typeof seedBootstrap;
  taxonomyBootstrap: typeof taxonomyBootstrap;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
