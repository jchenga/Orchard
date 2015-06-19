using System;
using CustomFields.DateTimeField.Settings;
using CustomFields.DateTimeField.ViewModels;
using Orchard;
using Orchard.ContentManagement;
using Orchard.ContentManagement.Drivers;
using Orchard.ContentManagement.Handlers;
using Orchard.Localization;

namespace CustomFields.DateTimeField.Drivers {
    public class DateTimeFieldDriver : ContentFieldDriver<Fields.DateTimeField> {

        // EditorTemplate/Fields/Custom.DateTime.cshtml
        private const string TemplateName = "Fields/Custom.DateTime";

        private readonly IOrchardServices _orchardServices;

        public DateTimeFieldDriver(IOrchardServices orchardServices) {
            _orchardServices = orchardServices;
            T = NullLocalizer.Instance;
        }

        public Localizer T { get; set; }

        protected override DriverResult Display(ContentPart part, Fields.DateTimeField field, string displayType, dynamic shapeHelper) {
            var settings = field.PartFieldDefinition.Settings.GetModel<DateTimeFieldSettings>();
            var value = field.DateTime;
            return ContentShape("Fields_Custom_DateTime",
                s =>
                    s.Name(field.Name)
                        .Date(value.HasValue ?
                            value.Value.ToLocalTime().ToShortDateString() :
                            string.Empty)
                        .Time(value.HasValue ?
                            value.Value.ToLocalTime().ToShortTimeString() :
                            String.Empty)
                        .ShowDate(
                            settings.Display == DateTimeFieldDisplays.DateAndTime ||
                            settings.Display == DateTimeFieldDisplays.DateOnly)
                        .ShowTime(
                            settings.Display == DateTimeFieldDisplays.DateAndTime ||
                            settings.Display == DateTimeFieldDisplays.TimeOnly));
        }

        protected override DriverResult Editor(ContentPart part, Fields.DateTimeField field, IUpdateModel updater, dynamic shapeHelper) {

            var viewModel = new DateTimeFieldViewModel();
            if (updater.TryUpdateModel(viewModel, GetPrefix(field, part), null, null)) {
                DateTime value;

                var settings = field.PartFieldDefinition.Settings.GetModel<DateTimeFieldSettings>();

                if (settings.Display == DateTimeFieldDisplays.DateOnly) {
                    viewModel.Time = DateTime.Now.ToShortTimeString();
                }

                if (settings.Display == DateTimeFieldDisplays.TimeOnly) {
                    viewModel.Date = DateTime.Now.ToShortDateString();
                }

                if (DateTime.TryParse(viewModel.Date + " " + viewModel.Time, out value)) {
                    field.DateTime = value.ToUniversalTime();
                }
                else {
                    updater.AddModelError(GetPrefix(field, part),
                        T("{0} is an invalid date and time",
                        field.Name));
                    field.DateTime = null;
                }
            }

            return Editor(part, field, shapeHelper);

        }

        protected override DriverResult Editor(ContentPart part, Fields.DateTimeField field, dynamic shapeHelper) {
            var settings = field.PartFieldDefinition.Settings.GetModel<DateTimeFieldSettings>();

            var value = field.DateTime;

            if (value.HasValue) {
                value = value.Value.ToLocalTime();
            }

            var viewModel = new DateTimeFieldViewModel {
                Name = field.Name,
                Date = value.HasValue ?
                        value.Value.ToLocalTime().ToShortDateString() : string.Empty,
                Time = value.HasValue ?
                        value.Value.ToLocalTime().ToShortTimeString() : string.Empty,
                ShowDate = settings.Display == DateTimeFieldDisplays.DateAndTime ||
                        settings.Display == DateTimeFieldDisplays.DateOnly,
                ShowTime = settings.Display == DateTimeFieldDisplays.DateAndTime ||
                        settings.Display == DateTimeFieldDisplays.TimeOnly
            };

            return ContentShape("Fields_Custom_DateTime_Edit",
                () => shapeHelper.EditorTemplate(
                    TemplateName: TemplateName,
                    Model: viewModel,
                    Prefix: GetPrefix(field, part)));
        }

        protected override void Importing(ContentPart part, Fields.DateTimeField field, ImportContentContext context) {
            var importedText = context.Attribute(GetPrefix(field, part), "DateTime");
            if (importedText != null) {
                field.Storage.Set(null, importedText);
            }
        }

        protected override void Exporting(ContentPart part, Fields.DateTimeField field, ExportContentContext context) {
            context.Element(GetPrefix(field, part)).SetAttributeValue("DateTime", field.Storage.Get<string>(null));
        }

        private static string GetPrefix(ContentField field, ContentPart part) {
            // handles spaces in field name
            return (part.PartDefinition.Name + "." + field.Name).Replace(" ", "_");
        }
    }
}