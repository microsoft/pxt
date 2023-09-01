interface IProps {
    highScoreInitials: string;
    highScoreScore: number;
}

const ExistingScoreEntry: React.FC<IProps> = ({
    highScoreInitials,
    highScoreScore,
}) => {
    return (
        <li>
            <span className="highScoreInitials">{highScoreInitials}</span>
            <span className="highScoreScore">{highScoreScore}</span>
        </li>
    );
};

export default ExistingScoreEntry;
