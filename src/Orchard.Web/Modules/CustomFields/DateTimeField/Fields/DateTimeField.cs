using System;
using System.Globalization;
using Orchard.ContentManagement;
using Orchard.ContentManagement.FieldStorage;
using Orchard.Environment.Extensions;

namespace CustomFields.DateTimeField.Fields {

    [OrchardFeature("DateTimeField")]
    public class DateTimeField : ContentField {

        public DateTime? DateTime {
            get {
                var value = Storage.Get<string>();
                DateTime parsedDateTime;
                if (System.DateTime.TryParse(value, CultureInfo.InvariantCulture,
                    DateTimeStyles.AdjustToUniversal, out parsedDateTime)) {
                    return parsedDateTime;
                }
                return null;
            }
            set {
                Storage.Set(value == null ? String.Empty : value.Value.ToString(CultureInfo.InvariantCulture));
            }
        }
    }
}