import { createBasicNotification } from "ui/Notifications/NotificationBase"

interface Arguments {
    text: string
}

export function notify(args: Arguments) {

    const {
        text
    } = args

    const notification = createBasicNotification({
        notificationText: text
    })

    notification.notify()
}