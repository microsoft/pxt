import { useEffect, useState } from "react";
import { GameData } from "../Models/GameData";
import { HighScore } from "../Models/HighScore";
import { Kiosk } from "../Models/Kiosk";
import { DeleteButton } from "./DeleteButton";
import HighScoresList from "./HighScoresList";
interface IProps {
    highScores: HighScore[];
    addButtonSelected: boolean;
    deleteButtonSelected: boolean;
    game: GameData;
}
const GameSlide: React.FC<IProps> = (
    {   highScores,
        addButtonSelected,
        deleteButtonSelected,
        game,
    }) => {
    const buttonSelected = addButtonSelected || deleteButtonSelected;
    const carouselSelected = buttonSelected ? "unselected" : "selected";

    return (
        <div className={`gameTile ${carouselSelected}`}>
            <div className="gameThumbnail" 
                style={{backgroundImage: `url("https://makecode.com/api/${game.id}/thumb")`}}
            />

            <p className="pressStart">Press A to Start</p>

            <div className="gameDetails">
                <div className="gameTitle">{game.name}</div>
                <div className="gameDescription">{game.description} <hr/></div>
                <HighScoresList highScores={highScores} highScoreMode={game.highScoreMode} />
                {
                    game.date &&
                    <div className="gameDate">
                        Added {game.date}
                    </div>
                }
                { game.userAdded &&
                    <DeleteButton focused={deleteButtonSelected} />
                }
            </div>
        </div>
    )
}

export default GameSlide;
