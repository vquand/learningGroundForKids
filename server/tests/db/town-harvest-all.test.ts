import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
import {assertSafeTestDatabaseUrl} from '../../src/db/test-database.ts';
import {createTownRepository} from '../../src/town-building/repository.ts';
import {AppError} from '../../src/errors.ts';
import {freshPatch,GROW_SECONDS} from '../../src/town-building/garden.ts';
import type {HarvestAllCommand} from '../../src/town-building/harvestTypes.ts';

const configured=process.env.TEST_DATABASE_URL;
test('harvest-all commits once per revision in the real Town transaction, dedupes concurrent retries and keeps the ledger durable',{skip:configured?false:'TEST_DATABASE_URL is not configured'},async()=>{
    const url=assertSafeTestDatabaseUrl(configured!,[process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter((v):v is string=>!!v));
    const pool=new Pool({connectionString:url,max:8}),family=randomUUID(),profile=randomUUID();
    let now=1000;const repo=createTownRepository(pool,()=>now),second=createTownRepository(pool,()=>now);
    const env={season:'spring' as const,precipitation:'none' as const,timeOfDay:'morning' as const,localTime:'09:00',localDate:'2026-11-02'};
    const command:HarvestAllCommand={type:'harvest-all',category:'animals',mapId:'town'};
    try {
        await migrate(drizzle(pool),{migrationsFolder:fileURLToPath(new URL('../../drizzle',import.meta.url))});
        await pool.query('INSERT INTO families(id,email,display_name,password_hash,role) VALUES($1,$2,$3,$4,$5)',[family,`${family}@harvest.test`,'Harvest test','unused','admin']);
        await pool.query('INSERT INTO profiles(id,family_id,name,public_id,emoji,color) VALUES($1,$2,$3,$1,$4,$5)',[profile,family,'Harvest child','apple','green']);
        const state=await repo.get(profile);
        state.entities=[
            {id:'plot',blueprintId:'vegetable-patch',x:4,y:4,paidCost:{},garden:freshPatch('spring')},
            {id:'coop',blueprintId:'coop',animal:'chicken',x:8,y:4,paidCost:{},poultry:{eggs:3,progress:0,lastTick:now,rate:1,generation:0}},
        ];
        state.entities[0]!.garden!.slots.forEach(slot=>{slot.growth=GROW_SECONDS;});
        await pool.query('UPDATE town_state SET state=$2 WHERE profile_id=$1',[profile,JSON.stringify(state)]);
        const before=await repo.get(profile);
        const stamina=before.materials.stamina;

        // Two app instances race the same request: one commit, the other sees the committed ledger.
        const race=await Promise.all([repo.harvestAll!(profile,before.revision,command,env),second.harvestAll!(profile,before.revision,command,env)]);
        assert.equal(race.filter(r=>!r.receipt.duplicate).length,1);
        assert.equal(new Set(race.map(r=>r.receipt.id)).size,1);
        const after=await second.get(profile);
        assert.equal(after.revision,before.revision+1);
        assert.equal(after.materials.stamina,stamina+6,'eggs pay once');
        assert.equal(after.poultry?.harvested,3);

        // Stale and empty requests reject without any write.
        await assert.rejects(()=>repo.harvestAll!(profile,after.revision+1,command,env),(e:unknown)=>e instanceof AppError&&e.code==='TOWN_STALE');
        await assert.rejects(()=>repo.harvestAll!(profile,after.revision,{type:'harvest-all',category:'fish',mapId:'town'},env),(e:unknown)=>e instanceof AppError&&e.code==='HARVEST_EMPTY');
        assert.equal((await second.get(profile)).revision,after.revision);

        // The retry ledger is durable (Town JSON), so a later retry dedupes without awarding again.
        const ledger=await pool.query<{n:number}>("SELECT jsonb_array_length(state->'harvestReceipts') AS n FROM town_state WHERE profile_id=$1",[profile]);
        assert.equal(ledger.rows[0]?.n,1);
        const retry=await repo.harvestAll!(profile,before.revision,command,env);
        assert.equal(retry.receipt.duplicate,true);
        assert.equal((await second.get(profile)).materials.stamina,stamina+6);
    }finally{await pool.query('DELETE FROM families WHERE id=$1',[family]);await pool.end();}
});
