import { Diagnostic, FileReference, DiagnosticMessage, CommentRange, SyntaxKind, Declaration, SymbolWriter, ScriptReferenceHost, SourceFile, WriteFileCallback, ResolvedModule, DeclarationName, DiagnosticMessageChain, TextSpan, NodeFlags, Block, ReturnStatement, YieldExpression, VariableLikeDeclaration, AccessorDeclaration, ClassLikeDeclaration, FunctionLikeDeclaration, MethodDeclaration, TypeNode, EntityName, Expression, CallLikeExpression, PropertyAccessExpression, ElementAccessExpression, ModuleDeclaration, ImportEqualsDeclaration, CallExpression, JSDocTypeTag, JSDocReturnTag, JSDocTemplateTag, ParameterDeclaration, JSDocParameterTag, SignatureDeclaration, BindingPattern, Identifier, StringLiteral, LiteralExpression, ExpressionWithTypeArguments, NodeArray, InterfaceDeclaration, HeritageClause, TextRange, QualifiedName, CompilerOptions, ScriptTarget, ModuleKind, ConstructorDeclaration } from "../ext-typescript/lib/tsserverlibrary";

declare namespace ts {
    function getNodeId(node: ts.Node): number;
    interface Node extends TextRange {
        symbol?: Symbol;                // Symbol declared by node (initialized by binding)
    }


    interface DiagnosticCollection {
        add(diagnostic: Diagnostic): void;
        getGlobalDiagnostics(): Diagnostic[];
        getDiagnostics(fileName?: string): Diagnostic[];
        getModificationCount(): number;
    }


    interface ReferencePathMatchResult {
        fileReference?: FileReference;
        diagnosticMessage?: DiagnosticMessage;
        isNoDefaultLib?: boolean;
    }
    interface SynthesizedNode extends ts.Node {
        leadingCommentRanges?: CommentRange[];
        trailingCommentRanges?: CommentRange[];
        startsOnNewLine: boolean;
    }
    function getDeclarationOfKind(symbol: Symbol, kind: SyntaxKind): Declaration;
    interface StringSymbolWriter extends SymbolWriter {
        string(): string;
    }
    interface EmitHost extends ScriptReferenceHost {
        getSourceFiles(): SourceFile[];
        getCommonSourceDirectory(): string;
        getCanonicalFileName(fileName: string): string;
        getNewLine(): string;
        isEmitBlocked(emitFileName: string): boolean;
        writeFile: WriteFileCallback;
    }
    function getSingleLineStringWriter(): StringSymbolWriter;
    function releaseStringWriter(writer: StringSymbolWriter): void;
    function getFullWidth(node: ts.Node): number;
    function arrayIsEqualTo<T>(array1: T[], array2: T[], equaler?: (a: T, b: T) => boolean): boolean;
    function hasResolvedModule(sourceFile: SourceFile, moduleNameText: string): boolean;
    function getResolvedModule(sourceFile: SourceFile, moduleNameText: string): ResolvedModule;
    function setResolvedModule(sourceFile: SourceFile, moduleNameText: string, resolvedModule: ResolvedModule): void;
    function containsParseError(node: ts.Node): boolean;
    function getSourceFileOfNode(node: ts.Node): SourceFile;
    function getStartPositionOfLine(line: number, sourceFile: SourceFile): number;
    function nodePosToString(node: ts.Node): string;
    function getStartPosOfNode(node: ts.Node): number;
    function nodeIsMissing(node: ts.Node): boolean;
    function nodeIsPresent(node: ts.Node): boolean;
    function getTokenPosOfNode(node: ts.Node, sourceFile?: SourceFile): number;
    function getNonDecoratorTokenPosOfNode(node: ts.Node, sourceFile?: SourceFile): number;
    function getSourceTextOfNodeFromSourceFile(sourceFile: SourceFile, node: ts.Node, includeTrivia?: boolean): string;
    function getTextOfNodeFromSourceText(sourceText: string, node: ts.Node): string;
    function getTextOfNode(node: ts.Node, includeTrivia?: boolean): string;
    function escapeIdentifier(identifier: string): string;
    function unescapeIdentifier(identifier: string): string;
    function makeIdentifierFromModuleName(moduleName: string): string;
    function isBlockOrCatchScoped(declaration: Declaration): boolean;
    function getEnclosingBlockScopeContainer(node: ts.Node): ts.Node;
    function isCatchClauseVariableDeclaration(declaration: Declaration): boolean;
    function declarationNameToString(name: DeclarationName): string;
    function createDiagnosticForNode(node: ts.Node, message: DiagnosticMessage, arg0?: any, arg1?: any, arg2?: any): Diagnostic;
    function createDiagnosticForNodeFromMessageChain(node: ts.Node, messageChain: DiagnosticMessageChain): Diagnostic;
    function getSpanOfTokenAtPosition(sourceFile: SourceFile, pos: number): TextSpan;
    function getErrorSpanForNode(sourceFile: SourceFile, node: ts.Node): TextSpan;
    function isExternalModule(file: SourceFile): boolean;
    function isExternalOrCommonJsModule(file: SourceFile): boolean;
    function isDeclarationFile(file: SourceFile): boolean;
    function isConstEnumDeclaration(node: ts.Node): boolean;
    function getCombinedNodeFlags(node: ts.Node): NodeFlags;
    function isConst(node: ts.Node): boolean;
    function isLet(node: ts.Node): boolean;
    function isPrologueDirective(node: ts.Node): boolean;
    function getLeadingCommentRangesOfNode(node: ts.Node, sourceFileOfNode: SourceFile): CommentRange[];
    function getLeadingCommentRangesOfNodeFromText(node: ts.Node, text: string): CommentRange[];
    function getJsDocComments(node: ts.Node, sourceFileOfNode: SourceFile): CommentRange[];
    function getJsDocCommentsFromText(node: ts.Node, text: string): CommentRange[];
    let fullTripleSlashReferencePathRegEx: RegExp;
    let fullTripleSlashAMDReferencePathRegEx: RegExp;
    function isTypeNode(node: ts.Node): boolean;
    function forEachReturnStatement<T>(body: Block, visitor: (stmt: ReturnStatement) => T): T;
    function forEachYieldExpression(body: Block, visitor: (expr: YieldExpression) => void): void;
    function isVariableLike(node: ts.Node): node is VariableLikeDeclaration;
    function isAccessor(node: ts.Node): node is AccessorDeclaration;
    function isClassLike(node: ts.Node): node is ClassLikeDeclaration;
    function isFunctionLike(node: ts.Node): node is FunctionLikeDeclaration;
    function isFunctionLikeKind(kind: SyntaxKind): boolean;
    function introducesArgumentsExoticObject(node: ts.Node): boolean;
    function isIterationStatement(node: ts.Node, lookInLabeledStatements: boolean): boolean;
    function isFunctionBlock(node: ts.Node): boolean;
    function isObjectLiteralMethod(node: ts.Node): node is MethodDeclaration;
    // function isIdentifierTypePredicate(predicate: TypePredicate): predicate is IdentifierTypePredicate;
    function getContainingFunction(node: ts.Node): FunctionLikeDeclaration;
    function getContainingClass(node: ts.Node): ClassLikeDeclaration;
    function getThisContainer(node: ts.Node, includeArrowFunctions: boolean): ts.Node;
    /**
      * Given an super call\property node returns a closest node where either
      * - super call\property is legal in the node and not legal in the parent node the node.
      *   i.e. super call is legal in constructor but not legal in the class body.
      * - node is arrow function (so caller might need to call getSuperContainer in case it needs to climb higher)
      * - super call\property is definitely illegal in the node (but might be legal in some subnode)
      *   i.e. super property access is illegal in function declaration but can be legal in the statement list
      */
    function getSuperContainer(node: ts.Node, stopOnFunctions: boolean): ts.Node;
    function getEntityNameFromTypeNode(node: TypeNode): EntityName | Expression;
    function getInvokedExpression(node: CallLikeExpression): Expression;
    function nodeCanBeDecorated(node: ts.Node): boolean;
    function nodeIsDecorated(node: ts.Node): boolean;
    function isPropertyAccessExpression(node: ts.Node): node is PropertyAccessExpression;
    function isElementAccessExpression(node: ts.Node): node is ElementAccessExpression;
    function isExpression(node: ts.Node): boolean;
    function isExternalModuleNameRelative(moduleName: string): boolean;
    function isInstantiatedModule(node: ModuleDeclaration, preserveConstEnums: boolean): boolean;
    function isExternalModuleImportEqualsDeclaration(node: ts.Node): boolean;
    function getExternalModuleImportEqualsDeclarationExpression(node: ts.Node): Expression;
    function isInternalModuleImportEqualsDeclaration(node: ts.Node): node is ImportEqualsDeclaration;
    function isSourceFileJavaScript(file: SourceFile): boolean;
    function isInJavaScriptFile(node: ts.Node): boolean;
    /**
     * Returns true if the node is a CallExpression to the identifier 'require' with
     * exactly one string literal argument.
     * This function does not test if the node is in a JavaScript file or not.
    */
    function isRequireCall(expression: ts.Node): expression is CallExpression;
    // function getSpecialPropertyAssignmentKind(expression: ts.Node): SpecialPropertyAssignmentKind;
    function getExternalModuleName(node: ts.Node): Expression;
    function hasQuestionToken(node: ts.Node): boolean;
    function isJSDocConstructSignature(node: ts.Node): boolean;
    function getJSDocTypeTag(node: ts.Node): JSDocTypeTag;
    function getJSDocReturnTag(node: ts.Node): JSDocReturnTag;
    function getJSDocTemplateTag(node: ts.Node): JSDocTemplateTag;
    function getCorrespondingJSDocParameterTag(parameter: ParameterDeclaration): JSDocParameterTag;
    function hasRestParameter(s: SignatureDeclaration): boolean;
    function isRestParameter(node: ParameterDeclaration): boolean;
    function isLiteralKind(kind: SyntaxKind): boolean;
    function isTextualLiteralKind(kind: SyntaxKind): boolean;
    function isTemplateLiteralKind(kind: SyntaxKind): boolean;
    function isBindingPattern(node: ts.Node): node is BindingPattern;
    function isNodeDescendentOf(node: ts.Node, ancestor: ts.Node): boolean;
    function isInAmbientContext(node: ts.Node): boolean;
    function isDeclaration(node: ts.Node): boolean;
    function isStatement(n: ts.Node): boolean;
    function isClassElement(n: ts.Node): boolean;
    function isDeclarationName(name: ts.Node): name is Identifier | StringLiteral | LiteralExpression;
    function isIdentifierName(node: Identifier): boolean;
    function isAliasSymbolDeclaration(node: ts.Node): boolean;
    function getClassExtendsHeritageClauseElement(node: ClassLikeDeclaration): ExpressionWithTypeArguments;
    function getClassImplementsHeritageClauseElements(node: ClassLikeDeclaration): NodeArray<ExpressionWithTypeArguments>;
    function getInterfaceBaseTypeNodes(node: InterfaceDeclaration): NodeArray<ExpressionWithTypeArguments>;
    function getHeritageClause(clauses: NodeArray<HeritageClause>, kind: SyntaxKind): HeritageClause;
    function tryResolveScriptReference(host: ScriptReferenceHost, sourceFile: SourceFile, reference: FileReference): SourceFile;
    function getAncestor(node: ts.Node, kind: SyntaxKind): ts.Node;
    function getFileReferenceFromReferencePath(comment: string, commentRange: CommentRange): ReferencePathMatchResult;
    function isKeyword(token: SyntaxKind): boolean;
    function isTrivia(token: SyntaxKind): boolean;
    function isAsyncFunctionLike(node: ts.Node): boolean;
    function isStringOrNumericLiteral(node: ts.Node): boolean;
    /**
     * A declaration has a dynamic name if both of the following are true:
     *   1. The declaration has a computed property name
     *   2. The computed name is *not* expressed as Symbol.<name>, where name
     *      is a property of the Symbol constructor that denotes a built in
     *      Symbol.
     */
    function hasDynamicName(declaration: Declaration): boolean;
    function isDynamicName(name: DeclarationName): boolean;
    /**
     * Checks if the expression is of the form:
     *    Symbol.name
     * where Symbol is literally the word "Symbol", and name is any identifierName
     */
    function isWellKnownSymbolSyntactically(node: Expression): boolean;
    function getPropertyNameForPropertyNameNode(name: DeclarationName): string;
    function getPropertyNameForKnownSymbolName(symbolName: string): string;
    /**
     * Includes the word "Symbol" with unicode escapes
     */
    function isESSymbolIdentifier(node: ts.Node): boolean;
    function isModifierKind(token: SyntaxKind): boolean;
    function isParameterDeclaration(node: VariableLikeDeclaration): boolean;
    function getRootDeclaration(node: ts.Node): ts.Node;
    function nodeStartsNewLexicalEnvironment(n: ts.Node): boolean;
    /**
     * Creates a shallow, memberwise clone of a node. The "kind", "pos", "end", "flags", and "parent"
     * properties are excluded by default, and can be provided via the "location", "flags", and
     * "parent" parameters.
     * @param node The node to clone.
     * @param location An optional TextRange to use to supply the new position.
     * @param flags The NodeFlags to use for the cloned node.
     * @param parent The parent for the new node.
     */
    function cloneNode<T extends ts.Node>(node: T, location?: TextRange, flags?: NodeFlags, parent?: ts.Node): T;
    /**
     * Creates a deep clone of an EntityName, with new parent pointers.
     * @param node The EntityName to clone.
     * @param parent The parent for the cloned node.
     */
    function cloneEntityName(node: EntityName, parent?: ts.Node): EntityName;
    function isQualifiedName(node: ts.Node): node is QualifiedName;
    function nodeIsSynthesized(node: ts.Node): boolean;
    function createSynthesizedNode(kind: SyntaxKind, startsOnNewLine?: boolean): ts.Node;
    function createSynthesizedNodeArray(): NodeArray<any>;
    function createDiagnosticCollection(): DiagnosticCollection;
    /**
     * Based heavily on the abstract 'Quote'/'QuoteJSONString' operation from ECMA-262 (24.3.2.2),
     * but augmented for a few select characters (e.g. lineSeparator, paragraphSeparator, nextLine)
     * Note that this doesn't actually wrap the input in double quotes.
     */
    function escapeString(s: string): string;
    function isIntrinsicJsxName(name: string): boolean;
    function escapeNonAsciiCharacters(s: string): string;
    interface EmitTextWriter {
        write(s: string): void;
        writeTextOfNode(text: string, node: ts.Node): void;
        writeLine(): void;
        increaseIndent(): void;
        decreaseIndent(): void;
        getText(): string;
        rawWrite(s: string): void;
        writeLiteral(s: string): void;
        getTextPos(): number;
        getLine(): number;
        getColumn(): number;
        getIndent(): number;
        reset(): void;
    }
    function getIndentString(level: number): string;
    function getIndentSize(): number;
    function createTextWriter(newLine: String): EmitTextWriter;
    /**
     * Resolves a local path to a path which is absolute to the base of the emit
     */
    function getExternalModuleNameFromPath(host: EmitHost, fileName: string): string;
    function getOwnEmitOutputFilePath(sourceFile: SourceFile, host: EmitHost, extension: string): string;
    function getEmitScriptTarget(compilerOptions: CompilerOptions): ScriptTarget;
    function getEmitModuleKind(compilerOptions: CompilerOptions): ModuleKind;
    interface EmitFileNames {
        jsFilePath: string;
        sourceMapFilePath: string;
        declarationFilePath: string;
    }
    function forEachExpectedEmitFile(host: EmitHost, action: (emitFileNames: EmitFileNames, sourceFiles: SourceFile[], isBundledEmit: boolean) => void, targetSourceFile?: SourceFile): void;
    function getSourceFilePathInNewDir(sourceFile: SourceFile, host: EmitHost, newDirPath: string): string;
    function writeFile(host: EmitHost, diagnostics: DiagnosticCollection, fileName: string, data: string, writeByteOrderMark: boolean): void;
    function getLineOfLocalPosition(currentSourceFile: SourceFile, pos: number): number;
    function getLineOfLocalPositionFromLineMap(lineMap: number[], pos: number): number;
    function getFirstConstructorWithBody(node: ClassLikeDeclaration): ConstructorDeclaration;
    function getSetAccessorTypeAnnotationNode(accessor: AccessorDeclaration): TypeNode;
    function getAllAccessorDeclarations(declarations: NodeArray<Declaration>, accessor: AccessorDeclaration): {
        firstAccessor: AccessorDeclaration;
        secondAccessor: AccessorDeclaration;
        getAccessor: AccessorDeclaration;
        setAccessor: AccessorDeclaration;
    };
    function emitNewLineBeforeLeadingComments(lineMap: number[], writer: EmitTextWriter, node: TextRange, leadingComments: CommentRange[]): void;
    function emitComments(text: string, lineMap: number[], writer: EmitTextWriter, comments: CommentRange[], trailingSeparator: boolean, newLine: string, writeComment: (text: string, lineMap: number[], writer: EmitTextWriter, comment: CommentRange, newLine: string) => void): void;
    /**
     * Detached comment is a comment at the top of file or function body that is separated from
     * the next statement by space.
     */
    function emitDetachedComments(text: string, lineMap: number[], writer: EmitTextWriter, writeComment: (text: string, lineMap: number[], writer: EmitTextWriter, comment: CommentRange, newLine: string) => void, node: TextRange, newLine: string, removeComments: boolean): {
        nodePos: number;
        detachedCommentEndPos: number;
    };
    function writeCommentRange(text: string, lineMap: number[], writer: EmitTextWriter, comment: CommentRange, newLine: string): void;
    function modifierToFlag(token: SyntaxKind): NodeFlags;
    function isLeftHandSideExpression(expr: Expression): boolean;
    function isAssignmentOperator(token: SyntaxKind): boolean;
    function isExpressionWithTypeArgumentsInClassExtendsClause(node: ts.Node): boolean;
    function isSupportedExpressionWithTypeArguments(node: ExpressionWithTypeArguments): boolean;
    function isRightSideOfQualifiedNameOrPropertyAccess(node: ts.Node): boolean;
    function isEmptyObjectLiteralOrArrayLiteral(expression: ts.Node): boolean;
    function getLocalSymbolForExportDefault(symbol: Symbol): Symbol;
    function hasJavaScriptFileExtension(fileName: string): boolean;
    /**
     * Serialize an object graph into a JSON string. This is intended only for use on an acyclic graph
     * as the fallback implementation does not check for circular references by default.
     */
    const stringify: (value: any) => string;
    /**
     * Converts a string to a base-64 encoded ASCII string.
     */
    function convertToBase64(input: string): string;
    function convertToRelativePath(absoluteOrRelativePath: string, basePath: string, getCanonicalFileName: (path: string) => string): string;
    function getNewLineCharacter(options: CompilerOptions): string;

}