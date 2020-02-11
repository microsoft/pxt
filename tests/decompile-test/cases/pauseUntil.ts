pauseUntil(() => true)
pauseUntil(() => true, 500)
pauseUntil(undefined);
pauseUntil(function () { return false; })
pauseUntil(function() { let x = 0; return x > 7 });