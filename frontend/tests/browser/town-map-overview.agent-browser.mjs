import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const session=`town-map-overview-${process.pid}`;
const base=process.env.LAKE_BROWSER_URL??'http://127.0.0.1:5186/tests/browser/town-lake-harness.html';
const ab=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:40000,maxBuffer:8*1024*1024});
const read=script=>{const raw=JSON.parse(ab('eval',`JSON.stringify(${script})`));return typeof raw==='string'?JSON.parse(raw):raw;};

function ref(role,label){
    const snapshot=ab('snapshot','-i');
    const line=snapshot.split('\n').find(item=>item.includes(`- ${role} "${label}"`));
    assert.ok(line,`${role} ${label} absent\n${snapshot}`);
    return '@'+/ref=(e\d+)/.exec(line)[1];
}

function click(label){
    ab('wait','--fn',`[...document.querySelectorAll('button')].some(button=>button.checkVisibility()&&!button.disabled&&(button.getAttribute('aria-label')??button.textContent).trim()===${JSON.stringify(label)})`);
    ab('click',ref('button',label));
}

function assertOverviewRows(language){
    const metrics=read(`(()=>{
        const rows=[...document.querySelectorAll('.town-map-summary-row')];
        return rows.map(row=>{
            const rowBox=row.getBoundingClientRect();
            const cluster=row.querySelector('.town-map-summary-icons').getBoundingClientRect();
            const count=row.querySelector('.town-map-summary-count').getBoundingClientRect();
            const items=[...row.querySelector('.town-map-summary-icons').children].map(item=>{const box=item.getBoundingClientRect();return {left:box.left,right:box.right,top:box.top,bottom:box.bottom,hidden:item.getAttribute('aria-hidden')==='true'}});
            return {height:rowBox.height,clusterRight:cluster.right,countLeft:count.left,scrollHeight:row.scrollHeight,clientHeight:row.clientHeight,items,ariaLabel:row.getAttribute('aria-label'),title:row.getAttribute('title')};
        });
    })()`);
    assert.ok(metrics.length>=5,`${language}: expected buildings, plants, roads, bridges, and animal houses rows`);
    for(const metric of metrics){
        assert.ok(metric.clusterRight<metric.countLeft,`${language}: icons overlap the count: ${JSON.stringify(metric)}`);
        assert.equal(metric.scrollHeight,metric.clientHeight,`${language}: row content wrapped: ${JSON.stringify(metric)}`);
        assert.ok(metric.items.every(item=>item.hidden),`${language}: summary artwork must be aria-hidden`);
        assert.ok(metric.items.every(item=>item.bottom<=metric.items[0].bottom+0.5&&item.top>=metric.items[0].top-0.5),`${language}: icons must stay on one line: ${JSON.stringify(metric)}`);
    }
    const many=metrics.find(metric=>metric.items.length>4);
    assert.ok(many,`${language}: expected a row with more than four kinds`);
    assert.equal(many.items.length,10,`${language}: all ten building kinds must be shown without a four-icon cap`);
    for(let index=1;index<many.items.length;index++){
        assert.ok(many.items[index].left<many.items[index-1].right,`${language}: adjacent icons must overlap in the stack: ${JSON.stringify(many.items)}`);
    }
    assert.equal(many.ariaLabel,many.title,`${language}: row aria-label and title must match`);
    assert.match(many.ariaLabel,language==='vi'?/Các loại/:/Kinds/);
    assert.equal((many.ariaLabel.match(/× 1/g)??[]).length,10,`${language}: row label must list every kind with its count`);
    assert.equal(read('!!document.querySelector(".town-map-summary-more")'),false,`${language}: ten kinds do not need the safety overflow chip`);
}

try{
    for(const [width,height] of [[1366,768],[1024,768],[1180,820]]){
        for(const language of ['en','vi']){
            ab('open',`${base}?town=1&overview-many=1`);
            ab('set','viewport',String(width),String(height));
            ab('wait','--fn',`document.querySelector('.town-map-screen')?.getAttribute('aria-busy')==='false'&&!!document.querySelector('.town-map-summary-row')`);
            if(read('document.documentElement.lang')!==language){
                const current=read('document.documentElement.lang');
                click(current==='vi'?'Đổi ngôn ngữ giao diện':'Change interface language');
                click(language==='vi'?'Tiếng Việt':'English');
                ab('wait','--fn',`document.documentElement.lang===${JSON.stringify(language)}`);
            }
            assertOverviewRows(language);
            assert.equal(read('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),true,`${width}×${height} ${language}: no page scrolling`);
            console.log(`${width}×${height} ${language}: overview rows stay single-line and separated from counts`);
        }
    }
}finally{
    ab('close');
}
