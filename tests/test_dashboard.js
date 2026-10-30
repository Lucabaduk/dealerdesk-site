const D=require('../modules/dashboard-local.js');let pass=0,fail=0;const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m))};
const now=new Date('2026-10-30T09:00:00').getTime();
const r=D.summary({cars:[{id:'a',status:'available',price_cents:100},{id:'b',status:'sold',price_cents:200},{id:'c',status:'hold',price_cents:300}],
 deals:[{id:'d1',status:'closed',price_cents:5000,staff_id:'s1'},{id:'d2',status:'pending',date:'2026-10-20',buyer:'Pat'}],
 leads:[{id:'l1',status:'new',name:'Kim'},{id:'l2',status:'won'},{id:'l3',status:'contacted'}],
 test_drives:[{id:'t1',at:'2026-10-30T15:00',status:'requested',customer:{name:'Lee'}},{id:'t2',at:'2026-10-28T10:00',status:'confirmed',customer:{name:'Old'}}],
 service_bookings:[{id:'v1',at:'2026-11-02T08:00',status:'booked',customer:{name:'Shah'}},{id:'v2',at:'2026-10-30T08:00',status:'cancelled'}],
 staff:[{id:'s1',name:'Ana'},{id:'s2',name:'Bo'}]},now);
ok(r.counts.cars===3&&r.counts.available===1&&r.counts.sold===1&&r.counts.hold===1,'car counts');ok(r.counts.stock_value_cents===400,'stock value excludes sold');
ok(r.counts.leads_open===2&&r.counts.leads_new===1,'lead counts');ok(r.counts.bookings_today===1&&r.counts.bookings_upcoming===2,'bookings (cancelled skipped)');
ok(r.pipeline.map(p=>p.stage).join()==='new,contacted,qualified,won,lost'&&r.pipeline[0].count===1,'pipeline');
ok(r.sales.closed===1&&r.sales.revenue_cents===5000&&r.sales.avg_cents===5000&&r.sales.pending===1&&r.sales.by_staff[0].name==='Ana','sales');
const k=r.attention.map(a=>a.kind+':'+a.id);ok(k.includes('lead:l1')&&k.includes('test_drive:t1')&&k.includes('test_drive:t2')&&k.includes('deal:d2'),'attention items '+k);
ok(r.attention[0].severity==='high','urgent first');const e=D.summary({},now);ok(e.counts.cars===0&&e.attention.length===0,'empty data safe');
const big=D.summary({cars:Array.from({length:5000},(_,i)=>({id:'c'+i,status:'available',price_cents:1}))},now);ok(big.counts.available===5000,'5000 cars');
console.log('dashboard: '+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
