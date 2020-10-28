export interface WorkspaceProvider {
    getUserStateAsync(userId: string): Promise<UserState>;
    setUserStateAsync(id: string, state: UserState): Promise<UserState>;

    getProjectAsync(headerId: string): Promise<any>;
    setProjectAsync(headerId: string, state: any): Promise<void>;
    deleteProjectAsync(headerId: string): Promise<void>;
}