# Profiling performance

The performance counters are a generic PXT feature, but are currently mostly used in MakeCode Arcade.
To enable profiling of a given function, you need to call `control.enablePerfCounter("my perf counter")`
anywhere in that function.
The compiler will detect the call and instrument the function.
If you skip the name of the counter, the name and location of the function will be used.

To enable instrumentation append `?compiler=profile` before `#editor` in the address bar.
When building from command line, set environment variable `PXT_COMPILE_SWITCHES=profile`.

Now, run your code and look at JavaScript console. You should see output similar to this
every second:

```
Performance counter       total                   | since last              ~ medians
                               us   calls us/call |      us   calls us/call ~ 

SysScreen                   75661 /   745 =   102 |    3436 /    31 =   111 ~   119 ~~    95
all frame callbacks       1778455 /   743 =  2394 |   93212 /    31 =  3007 ~  2830 ~~  2830
info                       125510 /   744 =   169 |    4247 /    31 =   137 ~   145 ~~   114
controller_update           52073 /   744 =    70 |    2139 /    31 =    69 ~    71 ~~    69
tilemap_update               4276 /   744 =     6 |     163 /    31 =     5 ~     5 ~~     5
physics and collisions     822810 /   744 =  1106 |   41421 /    31 =  1336 ~  1245 ~~  1229
render background           58083 /   744 =    78 |    2824 /    31 =    91 ~   104 ~~    74
sprite_draw                192706 /   744 =   259 |    7100 /    31 =   229 ~   250 ~~   250
controller                  51603 /   744 =    69 |    2117 /    31 =    68 ~    70 ~~    70
phys_collisions            227381 /   945 =   241 |   15212 /    62 =   245 ~   196 ~~   165
overlapsCPP                 13426 /  4225 =     3 |     710 /   228 =     3 ~     0 ~~     0
```

All times are given in microseconds (us).

The first column is the name of the performance counter.
Then come the global stats since the beginning of the run - for each perf counter
you can see total time spent in it, how many times it was entered
and how long on average per entry.
The next set of numbers is similar, but only contains data since last perf counter
output.
After `~` comes the median time of the last 32 perf counter entries.
After `~~` comes the median of the last 10 medians.

Typical timing procedure is to:
* have the game stop (eg `control.panic(0)`) after say 800 frames
* reduce randomness by setting `RANDOM_SEED = 42` in `namespace userconfig`
* reload editor; run the game
* look at the median of medians in the last perf counter output

### Profiling on hardware

It's currently only supported on STM32F4.
You enable it with `?compiler=profile`, as above.

There will be no automatic dumping of profile counters, but you can use `control.dmesgProfileCounters()`
which will dump them to DMESG buffer (you can fit maybe 1 or 2 dumps in the buffer).
Then run `pxt hiddmesg`, while your device is connected over USB, which will show the profile on the console.
If you have a hardware debugger, you can also run `pxt dmesg`.
The format is simpler than in JavaScript - it shows the number of calls, total time in microseconds, and the counter name.

## Profiling memory

You can track live objects in the heap, when running in the simulator.
You do it with `control.heapSnapshot()` API. Typically it's used like this:

```typescript
game.onUpdateInterval(5000, function () {
    control.heapSnapshot()
})
```

You can also trigger it between game levels, or in some other well-defined points.

Each call creates a heap snapshot.
For every snapshots it prints number of live objects of each type, the biggest 20 objects, and new objects.

New objects are only identified after the third snapshot has been taken.
Given three snapshots S0, S1, S2, a new object is one which was not present
in S0, but is present in both S1 and S2.
Additionally, if there is no more than `maxBgInstances` (which is set in `//%...` comments on
class definition and defaults to zero) of objects of given
type in S2, the object is not considered new.

The profiler doesn't currently track strings and numbers.
Also, the memory reported for arrays is a low bound (the memory allocated is larger due
to growth factor of arrays).
Finally, on hardware heap fragmentation might mean less memory is available than
one would think.

### Profiling on hardware

You can use `control.gcStats()`. It will return an object with various garbage collector
statistics. Example output:

```json
{
  "numGC": 146,
  "numBlocks": 1,
  "totalBytes": 87712,
  "lastFreeBytes": 34976,
  "lastMaxBlockBytes": 25092,
  "minFreeBytes": 32328
}
```

The GC has run 146 times since reset.
It has allocated 1 chunk of memory (this is typically 1 or 2), with a
total size (of all chunks is more than 1) of 87712 bytes.
Upon last collection, there were 34976 free bytes and the biggest
contiguous block was 25092 bytes (this is the largest allocation that
would still succeed right after that last collection).
Since reset, the minimum free memory was 32328
(which means that if the device had 32k less memory it would crash).
