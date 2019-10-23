let x = 1;
{
    let x = 1;
    x++;
}

x++;

{
    {
        {
            let x = 2;
            x++;
        }
    }
}

x++;

if (!!true) {
    let x = 3;
    x++;
}

x++;

while (!!true) {
    let x = 4;
    x++;
}

x++;

{
    let y = 1;
    y++;
}

{
    let y = 1;
    y++;
}