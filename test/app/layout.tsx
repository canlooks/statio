import {ReactNode} from 'react'

export default async function AppLayout({
    children
}: {
    children: ReactNode
}) {
    return (
        <html style={{fontSize: 14}}>
        <body style={{margin: 0}}>
        {children}
        </body>
        </html>
    )
}