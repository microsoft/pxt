# Profiling performance

The performance counters are a generic PXT feature, but are currently mostly used in MakeCode Arcade.
To enable profiling of a given function, you need to call `control.enablePerfCounter("my perf counter")`
anywhere in that function.
The compiler will detect the call and instrument the function.

To enable instrumentation append `?compiler=profile` before `#editor` in the address bar.

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
