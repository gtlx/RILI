pub fn with_transaction<F, T>(conn: &rusqlite::Connection, f: F) -> Result<T, rusqlite::Error>
where
    F: FnOnce(&rusqlite::Transaction) -> Result<T, rusqlite::Error>,
{
    let tx = conn.unchecked_transaction()?;
    let result = f(&tx)?;
    tx.commit()?;
    Ok(result)
}
