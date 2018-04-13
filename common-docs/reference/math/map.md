# map

Convert a value in one number range to a value in another number range.

```sig
Math.map(0, 0, 0, 0, 0)
```

A _map_ is a conversion of one span of numbers to another. If a dog can live to 16 years and a person lives to 87 years, how do you make a 16 year life span seem like a 87 year life span? You say that one dog year is like some number of people years. This is a _mapping_ of dog years to people years. 
 
Fahrenheit and Celsius are different ways to measure temperature. Celsius doesn't use the same amount of degrees as Fahrenheit. So, there is more energy in one degree of Celsius. If you want to convert a temperature value of Fahrenheit (something between freezing and boiling maybe) to Celsius, you can use ``Math.map(50, 32, 212, 0, 100)``. The map makes `50` degrees of Fahrenheit turn into `10` degrees of Celsius. 

## Parameters

* **value**: a [number](/types/number) to convert from one range to another.
* **fromLow**: the low [number](/types/number) of the range to convert *from*.
* **fromHigh**: the high [number](/types/number) of the range to convert *from*
* **toLow**: the low [number](/types/number) of the range to convert *to*.
* **toHigh**: the high [number](/types/number) of the range to convert *to*.

## Returns

* a new value that is a [number](/types/number) converted from original **value** using a mapping of the **from** range into the **to** range.

# Example #example

Use a lifespan map to find out the age in "people years" of a dog that's `7` years old.

```block 
let dogsAge = 7 
let peoplesAge = Math.map(dogsAge, 1, 16, 15, 87) 
```

## See also

[constrain](/reference/math/constrain)