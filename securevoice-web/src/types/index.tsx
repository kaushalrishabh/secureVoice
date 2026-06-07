// ----- User ---------------------------------------------------

export interface User {
    id: string,
    email: string,
    username: string,
    first_name: string,
    last_name: string,
    dek_salt: string,
    dek: string,
    public_key: string,
    private_key_enc: string
}