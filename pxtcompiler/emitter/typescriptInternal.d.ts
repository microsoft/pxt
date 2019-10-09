declare namespace ts {
    function getNodeId(node: Node): number;
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
    interface SynthesizedNode extends Node {
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
    function getFullWidth(node: Node): number;
    function arrayIsEqualTo<T>(array1: T[], array2: T[], equaler?: (a: T, b: T) => boolean): boolean;
    function hasResolvedModule(sourceFile: SourceFile, moduleNameText: string): boolean;
    function getResolvedModule(sourceFile: SourceFile, moduleNameText: string): ResolvedModule;
    function setResolvedModule(sourceFile: SourceFile, moduleNameText: string, resolvedModule: ResolvedModule): void;
    function containsParseError(node: Node): boolean;
    function getSourceFileOfNode(node: Node): SourceFile;
    function getStartPositionOfLine(line: number, sourceFile: SourceFile): number;
    function nodePosToString(node: Node): string;
    function getStartPosOfNode(node: Node): number;
    function nodeIsMissing(node: Node): boolean;
    function nodeIsPresent(node: Node): boolean;
    function getTokenPosOfNode(node: Node, sourceFile?: SourceFile): number;
    function getNonDecoratorTokenPosOfNode(node: Node, sourceFile?: SourceFile): number;
    function getSourceTextOfNodeFromSourceFile(sourceFile: SourceFile, node: Node, includeTrivia?: boolean): string;
    function getTextOfNodeFromSourceText(sourceText: string, node: Node): string;
    function getTextOfNode(node: Node, includeTrivia?: boolean): string;
    function escapeIdentifier(identifier: string): string;
    function unescapeIdentifier(identifier: string): string;
    function makeIdentifierFromModuleName(moduleName: string): string;
    function isBlockOrCatchScoped(declaration: Declaration): boolean;
    function getEnclosingBlockScopeContainer(node: Node): Node;
    function isCatchClauseVariableDeclaration(declaration: Declaration): boolean;
    function declarationNameToString(name: DeclarationName): string;
    function createDiagnosticForNode(node: Node, message: DiagnosticMessage, arg0?: any, arg1?: any, arg2?: any): Diagnostic;
    function createDiagnosticForNodeFromMessageChain(node: Node, messageChain: DiagnosticMessageChain): Diagnostic;
    function getSpanOfTokenAtPosition(sourceFile: SourceFile, pos: number): TextSpan;
    function getErrorSpanForNode(sourceFile: SourceFile, node: Node): TextSpan;
    function isExternalModule(file: SourceFile): boolean;
    function isExternalOrCommonJsModule(file: SourceFile): boolean;
    function isDeclarationFile(file: SourceFile): boolean;
    function isConstEnumDeclaration(node: Node): boolean;
    function getCombinedNodeFlags(node: Node): NodeFlags;
    function isConst(node: Node): boolean;
    function isLet(node: Node): boolean;
    function isPrologueDirective(node: Node): boolean;
    function getLeadingCommentRangesOfNode(node: Node, sourceFileOfNode: SourceFile): CommentRange[];
    function getLeadingCommentRangesOfNodeFromText(node: Node, text: string): CommentRange[];
    function getJsDocComments(node: Node, sourceFileOfNode: SourceFile): CommentRange[];
    function getJsDocCommentsFromText(node: Node, text: string): CommentRange[];
    let fullTripleSlashReferencePathRegEx: RegExp;
    let fullTripleSlashAMDReferencePathRegEx: RegExp;
    function isTypeNode(node: Node): boolean;
    function forEachReturnStatement<T>(body: Block, visitor: (stmt: ReturnStatement) => T): T;
    function forEachYieldExpression(body: Block, visitor: (expr: YieldExpression) => void): void;
    function isVariableLike(node: Node): node is VariableLikeDeclaration;
    function isAccessor(node: Node): node is AccessorDeclaration;
    function isClassLike(node: Node): node is ClassLikeDeclaration;
    function isFunctionLike(node: Node): node is FunctionLikeDeclaration;
    function isFunctionLikeKind(kind: SyntaxKind): boolean;
    function introducesArgumentsExoticObject(node: Node): boolean;
    function isIterationStatement(node: Node, lookInLabeledStatements: boolean): boolean;
    function isFunctionBlock(node: Node): boolean;
    function isObjectLiteralMethod(node: Node): node is MethodDeclaration;
    // function isIdentifierTypePredicate(predicate: TypePredicate): predicate is IdentifierTypePredicate;
    function getContainingFunction(node: Node): FunctionLikeDeclaration;
    function getContainingClass(node: Node): ClassLikeDeclaration;
    function getThisContainer(node: Node, includeArrowFunctions: boolean): Node;
    /**
      * Given an super call\property node returns a closest node where either
      * - super call\property is legal in the node and not legal in the parent node the node.
      *   i.e. super call is legal in constructor but not legal in the class body.
      * - node is arrow function (so caller might need to call getSuperContainer in case it needs to climb higher)
      * - super call\property is definitely illegal in the node (but might be legal in some subnode)
      *   i.e. super property access is illegal in function declaration but can be legal in the statement list
      */
    function getSuperContainer(node: Node, stopOnFunctions: boolean): Node;
    function getEntityNameFromTypeNode(node: TypeNode): EntityName | Expression;
    function getInvokedExpression(node: CallLikeExpression): Expression;
    function nodeCanBeDecorated(node: Node): boolean;
    function nodeIsDecorated(node: Node): boolean;
    function isPropertyAccessExpression(node: Node): node is PropertyAccessExpression;
    function isElementAccessExpression(node: Node): node is ElementAccessExpression;
    function isExpression(node: Node): boolean;
    function isExternalModuleNameRelative(moduleName: string): boolean;
    function isInstantiatedModule(node: ModuleDeclaration, preserveConstEnums: boolean): boolean;
    function isExternalModuleImportEqualsDeclaration(node: Node): boolean;
    function getExternalModuleImportEqualsDeclarationExpression(node: Node): Expression;
    function isInternalModuleImportEqualsDeclaration(node: Node): node is ImportEqualsDeclaration;
    function isSourceFileJavaScript(file: SourceFile): boolean;
    function isInJavaScriptFile(node: Node): boolean;
    /**
     * Returns true if the node is a CallExpression to the identifier 'require' with
     * exactly one string literal argument.
     * This function does not test if the node is in a JavaScript file or not.
    */
    function isRequireCall(expression: Node): expression is CallExpression;
    // function getSpecialPropertyAssignmentKind(expression: Node): SpecialPropertyAssignmentKind;
    function getExternalModuleName(node: Node): Expression;
    function hasQuestionToken(node: Node): boolean;
    function isJSDocConstructSignature(node: Node): boolean;
    function getJSDocTypeTag(node: Node): JSDocTypeTag;
    function getJSDocReturnTag(node: Node): JSDocReturnTag;
    function getJSDocTemplateTag(node: Node): JSDocTemplateTag;
    function getCorrespondingJSDocParameterTag(parameter: ParameterDeclaration): JSDocParameterTag;
    function hasRestParameter(s: SignatureDeclaration): boolean;
    function isRestParameter(node: ParameterDeclaration): boolean;
    function isLiteralKind(kind: SyntaxKind): boolean;
    function isTextualLiteralKind(kind: SyntaxKind): boolean;
    function isTemplateLiteralKind(kind: SyntaxKind): boolean;
    function isBindingPattern(node: Node): node is BindingPattern;
    function isNodeDescendentOf(node: Node, ancestor: Node): boolean;
    function isInAmbientContext(node: Node): boolean;
    function isDeclaration(node: Node): boolean;
    function isStatement(n: Node): boolean;
    function isClassElement(n: Node): boolean;
    function isDeclarationName(name: Node): name is Identifier | StringLiteral | LiteralExpression;
    function isIdentifierName(node: Identifier): boolean;
    function isAliasSymbolDeclaration(node: Node): boolean;
    function getClassExtendsHeritageClauseElement(node: ClassLikeDeclaration): ExpressionWithTypeArguments;
    function getClassImplementsHeritageClauseElements(node: ClassLikeDeclaration): NodeArray<ExpressionWithTypeArguments>;
    function getInterfaceBaseTypeNodes(node: InterfaceDeclaration): NodeArray<ExpressionWithTypeArguments>;
    function getHeritageClause(clauses: NodeArray<HeritageClause>, kind: SyntaxKind): HeritageClause;
    function tryResolveScriptReference(host: ScriptReferenceHost, sourceFile: SourceFile, reference: FileReference): SourceFile;
    function getAncestor(node: Node, kind: SyntaxKind): Node;
    function getFileReferenceFromReferencePath(comment: string, commentRange: CommentRange): ReferencePathMatchResult;
    function isKeyword(token: SyntaxKind): boolean;
    function isTrivia(token: SyntaxKind): boolean;
    function isAsyncFunctionLike(node: Node): boolean;
    function isStringOrNumericLiteral(node: Node): boolean;
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
    function isESSymbolIdentifier(node: Node): boolean;
    function isModifierKind(token: SyntaxKind): boolean;
    function isParameterDeclaration(node: VariableLikeDeclaration): boolean;
    function getRootDeclaration(node: Node): Node;
    function nodeStartsNewLexicalEnvironment(n: Node): boolean;
    /**
     * Creates a shallow, memberwise clone of a node. The "kind", "pos", "end", "flags", and "parent"
     * properties are excluded by default, and can be provided via the "location", "flags", and
     * "parent" parameters.
     * @param node The node to clone.
     * @param location An optional TextRange to use to supply the new position.
     * @param flags The NodeFlags to use for the cloned node.
     * @param parent The parent for the new node.
     */
    function cloneNode<T extends Node>(node: T, location?: TextRange, flags?: NodeFlags, parent?: Node): T;
    /**
     * Creates a deep clone of an EntityName, with new parent pointers.
     * @param node The EntityName to clone.
     * @param parent The parent for the cloned node.
     */
    function cloneEntityName(node: EntityName, parent?: Node): EntityName;
    function isQualifiedName(node: Node): node is QualifiedName;
    function nodeIsSynthesized(node: Node): boolean;
    function createSynthesizedNode(kind: SyntaxKind, startsOnNewLine?: boolean): Node;
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
        writeTextOfNode(text: string, node: Node): void;
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
    function isExpressionWithTypeArgumentsInClassExtendsClause(node: Node): boolean;
    function isSupportedExpressionWithTypeArguments(node: ExpressionWithTypeArguments): boolean;
    function isRightSideOfQualifiedNameOrPropertyAccess(node: Node): boolean;
    function isEmptyObjectLiteralOrArrayLiteral(expression: Node): boolean;
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
