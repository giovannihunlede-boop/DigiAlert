using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DigiAlert.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id_user = table.Column<Guid>(type: "uuid", nullable: false),
                    role = table.Column<string>(type: "text", nullable: false),
                    parent_id = table.Column<Guid>(type: "uuid", nullable: true),
                    kiosk_token = table.Column<Guid>(type: "uuid", nullable: false),
                    company_name = table.Column<string>(type: "text", nullable: false),
                    email = table.Column<string>(type: "text", nullable: false),
                    password_hash = table.Column<string>(type: "text", nullable: false),
                    reset_token = table.Column<string>(type: "text", nullable: true),
                    reset_token_expires = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    api_key = table.Column<string>(type: "text", nullable: true),
                    sender_id = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: true),
                    email_api_key = table.Column<string>(type: "text", nullable: true),
                    email_sender = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id_user);
                });

            migrationBuilder.CreateTable(
                name: "contacts",
                columns: table => new
                {
                    id_contact = table.Column<Guid>(type: "uuid", nullable: false),
                    id_user = table.Column<Guid>(type: "uuid", nullable: false),
                    first_name = table.Column<string>(type: "text", nullable: true),
                    last_name = table.Column<string>(type: "text", nullable: true),
                    phone_number = table.Column<string>(type: "text", nullable: false),
                    email = table.Column<string>(type: "varchar(150)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_contacts", x => x.id_contact);
                    table.ForeignKey(
                        name: "FK_contacts_users_id_user",
                        column: x => x.id_user,
                        principalTable: "users",
                        principalColumn: "id_user",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "events",
                columns: table => new
                {
                    id_event = table.Column<Guid>(type: "uuid", nullable: false),
                    id_user = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "text", nullable: false),
                    start_datetime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    end_datetime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_events", x => x.id_event);
                    table.ForeignKey(
                        name: "FK_events_users_id_user",
                        column: x => x.id_user,
                        principalTable: "users",
                        principalColumn: "id_user",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "sms_templates",
                columns: table => new
                {
                    id_template = table.Column<Guid>(type: "uuid", nullable: false),
                    id_user = table.Column<Guid>(type: "uuid", nullable: false),
                    template_name = table.Column<string>(type: "text", nullable: false),
                    message_content = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sms_templates", x => x.id_template);
                    table.ForeignKey(
                        name: "FK_sms_templates_users_id_user",
                        column: x => x.id_user,
                        principalTable: "users",
                        principalColumn: "id_user",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "event_participants",
                columns: table => new
                {
                    id_event = table.Column<Guid>(type: "uuid", nullable: false),
                    id_contact = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_event_participants", x => new { x.id_event, x.id_contact });
                    table.ForeignKey(
                        name: "FK_event_participants_contacts_id_contact",
                        column: x => x.id_contact,
                        principalTable: "contacts",
                        principalColumn: "id_contact",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_event_participants_events_id_event",
                        column: x => x.id_event,
                        principalTable: "events",
                        principalColumn: "id_event",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "reminders",
                columns: table => new
                {
                    id_reminder = table.Column<Guid>(type: "uuid", nullable: false),
                    id_event = table.Column<Guid>(type: "uuid", nullable: false),
                    id_contact = table.Column<Guid>(type: "uuid", nullable: false),
                    scheduled_time = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    message_text = table.Column<string>(type: "text", nullable: false),
                    channel = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    api_response = table.Column<string>(type: "text", nullable: true),
                    purpose = table.Column<string>(type: "text", nullable: false, defaultValue: "REMINDER")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reminders", x => x.id_reminder);
                    table.ForeignKey(
                        name: "FK_reminders_contacts_id_contact",
                        column: x => x.id_contact,
                        principalTable: "contacts",
                        principalColumn: "id_contact",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_reminders_events_id_event",
                        column: x => x.id_event,
                        principalTable: "events",
                        principalColumn: "id_event",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_contacts_id_user",
                table: "contacts",
                column: "id_user");

            migrationBuilder.CreateIndex(
                name: "IX_event_participants_id_contact",
                table: "event_participants",
                column: "id_contact");

            migrationBuilder.CreateIndex(
                name: "IX_events_id_user",
                table: "events",
                column: "id_user");

            migrationBuilder.CreateIndex(
                name: "IX_reminders_id_contact",
                table: "reminders",
                column: "id_contact");

            migrationBuilder.CreateIndex(
                name: "IX_reminders_id_event",
                table: "reminders",
                column: "id_event");

            migrationBuilder.CreateIndex(
                name: "IX_sms_templates_id_user",
                table: "sms_templates",
                column: "id_user");

            migrationBuilder.CreateIndex(
                name: "IX_users_email",
                table: "users",
                column: "email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_participants");

            migrationBuilder.DropTable(
                name: "reminders");

            migrationBuilder.DropTable(
                name: "sms_templates");

            migrationBuilder.DropTable(
                name: "contacts");

            migrationBuilder.DropTable(
                name: "events");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
