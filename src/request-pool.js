// Limits model requests across all renderer windows. Foreground reads take the next
// available slot ahead of prewarming; a settings change never interrupts a request.
export function requestPool(limit) {
  const waiting = [], background = [];
  let running = 0, closed = false;
  function drain() {
    while (!closed && running < limit() && (waiting.length || background.length)) {
      const job = (waiting.length ? waiting : background).shift();
      running++;
      Promise.resolve().then(job.run).then(job.resolve,job.reject).finally(() => {
        running--;
        drain();
      });
    }
  }
  return {
    run(run, lowPriority=false) {
      if (closed) return Promise.reject(Error("插件已关闭"));
      return new Promise((resolve,reject) => {
        (lowPriority ? background : waiting).push({run,resolve,reject});
        drain();
      });
    },
    drain,
    close() {
      closed=true;
      for (const job of [...waiting,...background]) job.reject(Error("插件已关闭"));
      waiting.length=background.length=0;
    }
  };
}
