import * as React from "react";

export interface ConfettiProps {
    children?: React.ReactNode;
}

export const Confetti = (props: ConfettiProps) => {
    const { children } = props;
    const density = 100;
    return <div className="confetti-container">
        {children}
        {Array(density).fill(0).map((el, i) => {
            const style = {
                animationDelay: `${0.1 * (i % density)}s`,
                left: `${1 * (Math.floor(Math.random() * density))}%`
            }
            return <div key={i} style={style} className={`confetti ${Math.random() > 0.5 ? "reverse" : ""} color-${Math.floor(Math.random() * 9)}`} />
        })}
    </div>
}