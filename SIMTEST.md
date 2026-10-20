# Simulator test framework

## Goal

The simulator test framework enables black-box testing of Static TypeScript (STS)
MakeCode programs for a PXT target using STS and an framework API.  That is,
the we can use a MakeCode program to test a set of communicating MakeCode programs!

## Framework features

The framework supports the following features:

1. load/compile a MakeCode program (from any of the usual sources: github, share, workspace, in memory, etc.)

2. instrument target APIs (not functions in user program for now) for the following purposes:
   A. intercepting a call to a target API (shim or STS function from target). This has several uses:
      - asserting over the "visible" behavior of the target; for example, expecting basic.showNumber should show a particular value
      - recording the values sent to a target API (for purposes of record/replay)
   B. capture the return value of a "nondeterministic" call (for recording a trace)
      - randomness: Array._pickRandom, randint, Math.random, Math.randomRange
   C. short circuit the body of the call and provide a return value. There are two uses for this:
      - provide streams of values for sensors
      - replaying an non-deterministic API from trace

3. run/debug a (uniquely named) simulator with a given program

4. generate inputs to the simulator
   - send any of the declared events in the target to a (named) simulator. This is
     done using control.raiseEvent, for the most part.
   - provide streams of values for "environment inputs", such as sensors (see 2.C)

5. assert on outputs from the simulator

6. provide a policy mechanism for determining the "next state" of the entire system. For example,
   - when a radio message is sent by simJ, what others sims can receive it?
   - this policy mechanism, in the limit, could be used to implement model checking of the system

## Design

### Orchestrator/Scheduler
