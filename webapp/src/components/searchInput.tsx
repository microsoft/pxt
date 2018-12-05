
import * as React from "react";
import * as sui from "../sui";

export interface SearchInputProps extends React.HTMLProps<HTMLDivElement> {
    searchHandler: (inputValue: string) => void;
    ariaMessage?: string;
    placeholder?: string;
    loading?: boolean;
    disabled?: boolean;
    searchOnChange?: boolean;
    inputClassName?: string;
    autoFocus?: boolean;
}

export interface SearchInputState {
    inputValue?: string;
}

export class SearchInput extends React.Component<SearchInputProps, SearchInputState> {
    constructor(props: SearchInputProps) {
        super(props);
        this.state = {
            inputValue: ""
        }

        this.handleSearchKeyUpdate = this.handleSearchKeyUpdate.bind(this);
        this.handleClick = this.handleClick.bind(this);
    }

    handleSearchKeyUpdate(ev: React.KeyboardEvent<HTMLElement>) {
        // Call search when a user presses Enter
        if (ev.keyCode == 13) this.handleSearch(this.state.inputValue);
    }

    handleSearch(inputValue: string) {
        const { searchHandler } = this.props;
        searchHandler(inputValue);
    }

    handleClick() {
        this.handleSearch(this.state.inputValue);
    }

    private updateInputValue = (ev: React.ChangeEvent<HTMLInputElement>) => {
        const { searchOnChange } = this.props;
        const inputValue = (ev.target as any).value;
        this.setState({ inputValue });

        // If we search on change, call search
        if (searchOnChange) this.handleSearch(inputValue)
    }

    render() {
        const { ariaMessage, disabled, loading, placeholder, autoFocus, className, inputClassName, searchOnChange, searchHandler, ...rest } = this.props;
        const { inputValue } = this.state;

        return <div className={`ui search ${className || ''}`} {...rest}>
            <div className={`ui icon input ${inputClassName || ''}`}>
                <div aria-live="polite" className="accessible-hidden">{ariaMessage}</div>
                <input role="search" autoFocus={autoFocus} ref="searchInput" className="prompt" type="text" placeholder={placeholder}
                    onChange={this.updateInputValue} value={inputValue}
                    onKeyUp={this.handleSearchKeyUpdate} disabled={disabled}
                    autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
                <i role="button" onClick={this.handleClick} title={lf("Search")} style={{cursor: "pointer"}}
                    className={`search link icon ${disabled ? 'disabled' : ''} ${loading ? 'loading' : ''}`} ></i>
            </div>
        </div>
    }
}
