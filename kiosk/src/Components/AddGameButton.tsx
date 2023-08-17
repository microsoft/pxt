import "../Kiosk.css";
interface IProps {
    selected: boolean;
    content: string;
}

const AddGameButton: React.FC<IProps> = ({ selected, content }) => {
    const buttonClassBase = "kioskButton";
    const specificButtonClass = selected ? "buttonSelected" : "buttonUnselected";
    const kioskButtonClass = `${buttonClassBase} ${specificButtonClass}`;

    return (
        <div>
            <button className={kioskButtonClass}>{content}</button>
        </div>
    )
}

export default AddGameButton;