import type {ShopItem,ShopProduct} from './shopTypes.ts';
/** Server economy constants. Egg is reserved, but is not spendable Town stock. */
export const SHOP_PRODUCT_VALUES={wool:3,yarn:5,fish:4,egg:1,milk:2} as const;
export const shopItemValue=(item:ShopItem)=>SHOP_PRODUCT_VALUES[item==='wool'||item==='yarn'||item==='milk'?item:'fish'];
export interface ShopStock extends ShopProduct {at?:number}
/** Bounded 0/1 knapsack. At most total+4 units are useful (max product value is 5).
 * Equal value minimizes item count, then lexicographically consumes oldest perishable
 * units before non-spoiling stock. Stable item order breaks equal timestamps. */
export function selectShopPayment(stock:readonly ShopStock[],total:number):ShopProduct[]|null {
    if(!Number.isInteger(total)||total<1||total>60)throw new Error('Invalid shop total.');
    const cap=total+4;
    const tokens:ShopItem[]=[];
    const used=new Map<ShopItem,number>();
    for(const s of [...stock].sort((a,b)=>(a.at??Infinity)-(b.at??Infinity)||a.item.localeCompare(b.item))){
        const count=Math.min(s.amount,Math.floor(cap/shopItemValue(s.item))-(used.get(s.item)??0));
        for(let n=0;n<count;n++)tokens.push(s.item);
        used.set(s.item,(used.get(s.item)??0)+count);
    }
    const dp:(number[]|undefined)[]=Array.from({length:cap+1});dp[0]=[];
    const better=(a:number[],b:number[]):boolean=>{
        if(a.length!==b.length)return a.length<b.length;
        for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]!<b[i]!;
        return false;
    };
    for(const [index,item] of tokens.entries())for(let sum=cap;sum>=shopItemValue(item);sum--){
        const prev=dp[sum-shopItemValue(item)];if(!prev)continue;
        const candidate=[...prev,index],existing=dp[sum];
        if(!existing||better(candidate,existing))dp[sum]=candidate;
    }
    for(let sum=total;sum<=cap;sum++){
        const chosen=dp[sum];if(!chosen)continue;
        const counts=new Map<ShopItem,number>();
        for(const index of chosen){const item=tokens[index]!;counts.set(item,(counts.get(item)??0)+1);}
        return [...counts].map(([item,amount])=>({item,amount}));
    }
    return null;
}
