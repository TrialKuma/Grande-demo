export const ACTION_POINT_RULES = Object.freeze({party:6,solo:5,carryLimit:2});

export function baseActionPoints(stateOrMode){
  const mode=typeof stateOrMode==='string'?stateOrMode:stateOrMode?.challengeMode;
  return mode==='solo'?ACTION_POINT_RULES.solo:ACTION_POINT_RULES.party;
}

/** The existing AP meter owns both this round's budget and next round's preview. */
export function actionPointInfo(state){
  const base=baseActionPoints(state),carry=state.roundCarry||0;
  const nextCarry=Math.min(ACTION_POINT_RULES.carryLimit,Math.max(0,state.ap));
  return {base,carry,carryLimit:ACTION_POINT_RULES.carryLimit,current:state.ap,max:state.maxAp,nextCarry,nextTotal:base+nextCarry};
}

/** Only unused points carry; this never refunds an already paid response. */
export function refreshActionPoints(state){
  const {nextCarry,nextTotal}=actionPointInfo(state);
  state.roundCarry=nextCarry;
  state.maxAp=nextTotal;
  state.ap=nextTotal;
}
