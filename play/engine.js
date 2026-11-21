/* Pure game rules; browser and Node share the same implementation. */
(function (root) {
  'use strict';
  const STAGES = [
    {name:'瞌睡蟲', asset:'sleepy', place:'微光蘑菇森林', motto:'把精神叫醒，讓好奇心發光。', hp:50, damage:12},
    {name:'粗心鬼', asset:'careless', place:'歪歪文具小鎮', motto:'慢一點，藏在字裡的線索就會出現。', hp:60, damage:14},
    {name:'拖延怪', asset:'delay', place:'滴答時鐘山谷', motto:'現在開始，就是最好的時機。', hp:70, damage:16},
    {name:'懶惰龍', asset:'dragon', place:'棉花雲朵山', motto:'再多努力一步，你比想像中更厲害。', hp:80, damage:18},
    {name:'考試大魔王', asset:'boss', place:'星光知識城堡', motto:'相信自己，把學到的魔法施展出來！', hp:100, damage:20}
  ];
  const ITEMS = {potion:{price:25,heal:40}, crystal:{price:45,attack:10,max:3}, revive:{price:60,heal:50,max:2}};
  function shuffle(items, random) {
    const result=items.slice();
    for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
    return result;
  }
  function shuffledOptions(options,random){
    const result=shuffle(options,random);
    // Every question must actually differ from the source order, even when a shuffle is the identity.
    if(result.every((option,i)=>option.id===options[i].id)) result.push(result.shift());
    return result;
  }
  class TrialGame {
    constructor(questions, random=Math.random, now=()=>Date.now()) {
      if(!Array.isArray(questions)||questions.length<25) throw new Error('來源題庫不足 25 題。');
      if(new Set(questions.map(q=>q.id)).size!==questions.length) throw new Error('題庫含有重複識別碼。');
      for(const q of questions){
        if(!q.prompt?.trim()||q.options?.length!==4||new Set(q.options.map(o=>o.id)).size!==4||q.options.some(o=>!o.text?.trim())||!q.options.some(o=>o.id===q.correctOptionId)) throw new Error('題庫欄位或正解缺漏：'+q.id);
      }
      this.questions=questions;this.random=random;this.now=now;this.phase='intro';
    }
    start(){
      this.deck=shuffle(this.questions,this.random).slice(0,25).map(q=>({...q,options:shuffledOptions(q.options,this.random)}));
      this.phase='battle';this.stage=0;this.local=0;this.hp=100;this.coins=30;this.attack=20;this.crystals=0;this.revives=0;
      this.enemyHp=STAGES[0].hp;this.history=[];this.cleared=0;this.correct=0;this.earned=0;this.totalDamage=0;
      this.startedAt=this.now();this.endedAt=null;this.won=false;this.reason='';this.last=null;
      return this;
    }
    get current(){return this.deck?.[this.stage*5+this.local];}
    get stageInfo(){return STAGES[this.stage];}
    answer(optionId){
      if(this.phase!=='battle') return null;
      const q=this.current,option=q.options.find(o=>o.id===optionId);
      if(!option) return null;
      const correct=optionId===q.correctOptionId;
      let damage=0,lostHp=0,revived=false;
      if(correct){
        damage=Math.min(this.enemyHp,this.attack);this.enemyHp-=damage;this.totalDamage+=damage;
        this.coins+=15;this.earned+=15;this.correct++;
      }else{
        lostHp=Math.min(this.hp,this.stageInfo.damage);this.hp=Math.max(0,this.hp-this.stageInfo.damage);
        if(this.hp===0&&this.revives>0){this.revives--;this.hp=ITEMS.revive.heal;revived=true;}
      }
      const result={questionId:q.id,sourceRow:q.sourceRow,prompt:q.prompt,stage:this.stage,chosenId:optionId,chosenText:option.text,correctId:q.correctOptionId,correctText:q.options.find(o=>o.id===q.correctOptionId).text,correct,damage,lostHp,revived};
      this.history.push(result);this.last=result;this.phase='feedback';return result;
    }
    next(){
      if(this.phase!=='feedback')return;
      if(this.hp<=0){this.finish(false,'魔力暫時耗盡了。休息一下，再試一次吧！');return;}
      if(this.local<4){this.local++;this.phase='battle';this.last=null;return;}
      if(this.enemyHp>0){this.finish(false,'這次還沒擊退'+this.stageInfo.name+'。複習正解，再回來挑戰！');return;}
      this.cleared++;this.coins+=20;this.earned+=20;this.phase='shop';
    }
    canBuy(item){
      if(this.phase!=='shop'||!ITEMS[item]||this.coins<ITEMS[item].price)return false;
      if(item==='potion'&&this.hp>=100)return false;
      if(item==='crystal'&&this.crystals>=ITEMS.crystal.max)return false;
      if(item==='revive'&&this.revives>=ITEMS.revive.max)return false;
      return true;
    }
    buy(item){
      if(!this.canBuy(item))return {ok:false,message:'目前無法購買這項道具。'};
      this.coins-=ITEMS[item].price;
      let message='';
      if(item==='potion'){const healed=Math.min(100-this.hp,40);this.hp+=healed;message='喝下回血藥水，恢復 '+healed+' HP！';}
      if(item==='crystal'){this.crystals++;this.attack+=10;message='水晶融入魔杖，永久攻擊力提升為 '+this.attack+'！';}
      if(item==='revive'){this.revives++;message='復活符已收進背包。HP 歸零時會自動回復 50 HP。';}
      return {ok:true,message};
    }
    leaveShop(){
      if(this.phase!=='shop')return;
      if(this.stage===4){this.finish(true,'你用知識和勇氣，點亮了整座魔法世界。');return;}
      this.stage++;this.local=0;this.enemyHp=this.stageInfo.hp;this.last=null;this.phase='battle';
    }
    finish(won,reason){this.phase='result';this.won=won;this.reason=reason;this.endedAt=this.now();}
    get accuracy(){return this.history?.length?Math.round(this.correct/this.history.length*100):0;}
    get score(){return (this.correct||0)*4;}
    get elapsedSeconds(){return Math.max(0,Math.floor(((this.endedAt??this.now())-this.startedAt)/1000));}
  }
  root.TrialRules={TrialGame,STAGES,ITEMS,shuffle,shuffledOptions};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.TrialRules;
})(typeof window!=='undefined'?window:globalThis);
