import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import {fileURLToPath} from 'node:url';

const testDirectory=path.dirname(fileURLToPath(import.meta.url));
const frontendSource=path.resolve(testDirectory,'../src');
const serverSource=path.resolve(testDirectory,'../../server/src');
const blockedPackages=['zod','hono','pg','drizzle-orm'];

interface ImportEdge {spec:string;runtime:boolean;kind:string}
interface Trace {file:string;chain:string[]}

function sourceFiles(directory:string):string[]{
    return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
        const full=path.join(directory,entry.name);
        return entry.isDirectory()?sourceFiles(full):/\.(ts|tsx)$/.test(entry.name)?[full]:[];
    });
}

function importEdges(file:string):ImportEdge[]{
    const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
    const edges:ImportEdge[]=[];
    for(const statement of source.statements){
        if(ts.isImportDeclaration(statement)&&ts.isStringLiteral(statement.moduleSpecifier)){
            const clause=statement.importClause;
            const runtime=!clause
                ||(!clause.isTypeOnly&&(!clause.namedBindings||!ts.isNamedImports(clause.namedBindings)||clause.namedBindings.elements.some(element=>!element.isTypeOnly)));
            edges.push({spec:statement.moduleSpecifier.text,runtime,kind:'import'});
        }else if(ts.isExportDeclaration(statement)&&statement.moduleSpecifier&&ts.isStringLiteral(statement.moduleSpecifier)){
            const named=statement.exportClause&&ts.isNamedExports(statement.exportClause)?statement.exportClause.elements:[];
            const runtime=!statement.isTypeOnly&&(!named.length||named.some(element=>!element.isTypeOnly));
            edges.push({spec:statement.moduleSpecifier.text,runtime,kind:'export'});
        }
    }
    function visit(node:ts.Node):void{
        if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&node.arguments.length===1&&ts.isStringLiteral(node.arguments[0]))
            edges.push({spec:node.arguments[0].text,runtime:true,kind:'dynamic import'});
        ts.forEachChild(node,visit);
    }
    ts.forEachChild(source,visit);
    return edges;
}

function resolveRelative(from:string,spec:string):string|null{
    if(!spec.startsWith('.'))return null;
    const raw=path.resolve(path.dirname(from),spec);
    const candidates=[raw,raw.replace(/\.js$/,'.ts'),raw.replace(/\.jsx$/,'.tsx'),`${raw}.ts`,`${raw}.tsx`,`${raw}/index.ts`,`${raw}/index.tsx`];
    return candidates.find(candidate=>fs.existsSync(candidate)&&fs.statSync(candidate).isFile())??null;
}

function blockedPackage(spec:string):boolean{
    return spec.startsWith('node:')||blockedPackages.some(name=>spec===name||spec.startsWith(`${name}/`));
}

function findViolations():Trace[]{
    const queue:Trace[]=sourceFiles(frontendSource).map(file=>({file,chain:[file]}));
    const visited=new Set<string>();
    const violations:Trace[]=[];
    while(queue.length){
        const current=queue.shift()!;
        if(visited.has(current.file))continue;
        visited.add(current.file);
        for(const edge of importEdges(current.file)){
            if(!edge.runtime)continue;
            const target=resolveRelative(current.file,edge.spec);
            if(target){
                const next={file:target,chain:[...current.chain,`${target} (${edge.kind} ${edge.spec})`]};
                if(target===path.join(serverSource,'errors.ts'))violations.push(next);
                if(target.startsWith(frontendSource)||target.startsWith(serverSource))queue.push(next);
            }else if(current.file.startsWith(serverSource)&&blockedPackage(edge.spec)){
                violations.push({file:current.file,chain:[...current.chain,`${edge.spec} (${edge.kind})`]});
            }
        }
    }
    return violations;
}

test('frontend runtime imports never reach server-only modules',()=>{
    const violations=findViolations();
    assert.equal(violations.length,0,violations.map(violation=>violation.chain.join('\n  -> ')).join('\n\n'));
});
