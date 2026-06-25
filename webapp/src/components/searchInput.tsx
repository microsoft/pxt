
import * as React from "react";
import { Input } from "../../../react-common/components/controls/Input";
import * as sui from "../sui";

export interface SearchInputProps extends React.HTMLProps<HTMLDivElement> {
    defaultValue?: string;
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
            inputValue: props?.defaultValue || ""
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

    private updateInputValue = (newValue: string) => {
        const { searchOnChange } = this.props;
        const inputValue = newValue;
        this.setState({ inputValue });

        // If we search on change, call search
        if (searchOnChange) this.handleSearch(inputValue)
    }

    render() {
        const { ariaMessage, disabled, loading, placeholder, autoFocus, className, inputClassName, searchOnChange, searchHandler, ...rest } = this.props;
        const { inputValue } = this.state;

        return <div className={className} {...rest}>
            <div className={inputClassName}>
                <div aria-live="polite" className="accessible-hidden" id="searchInputBoxLabel">{ariaMessage}</div>
                <Input
                    className="search-input project-manager"
                    type="text"
                    role="search"
                    autoFocus={autoFocus}
                    onChange={this.updateInputValue}
                    onEnterKey={this.handleSearch}
                    placeholder={placeholder}
                    initialValue={inputValue}
                    disabled={disabled}
                    autoComplete={false}
                    aria-labelledby="searchInputBoxLabel"
                    icon={`search link icon ${disabled ? 'disabled' : ''} ${loading ? 'loading' : ''}`}
                />
            </div>
        </div>
    }
}
